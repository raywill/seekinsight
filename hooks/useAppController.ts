
import { useEffect, useCallback } from 'react';
import { DevMode, Suggestion, Notebook, PublishedApp, Dataset, ProjectState } from '../types';
import { setDatabaseEngine, getDatabaseEngine } from '../services/dbService';
import { fetchApp, cloneNotebook } from '../services/appService';
import { MySQLEngine } from '../services/mysqlEngine';
import { PostgresEngine } from '../services/postgresEngine';
import { useFileUpload } from './useFileUpload';

// Import split hooks
import { useUIState } from './useUIState';
import { useProjectState } from './useProjectState';
import { useExecutionLogic } from './useExecutionLogic';
import { useAILogic } from './useAILogic';

export const useAppController = () => {
  const gatewayUrl = (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';

  // 1. Initialize State Hooks
  const ui = useUIState();
  const proj = useProjectState(gatewayUrl);

  // 2. Helper Logic
  const syncSuggestionsToDb = async (suggestions: Suggestion[]) => {
    if (!proj.currentNotebook) return;
    try {
      await fetch(`${gatewayUrl}/notebooks/${proj.currentNotebook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestions_json: JSON.stringify(suggestions) })
      });
    } catch (e) {
      console.warn("Failed to sync suggestions to database", e);
    }
  };

  const handleUpdateTopic = async (newTopic: string) => {
    const trimmed = newTopic.trim();
    if (!trimmed) {
      ui.setIsEditingTopic(false);
      return;
    }
    const finalTopic = trimmed.substring(0, 30);
    if (finalTopic !== proj.project.topicName) {
      proj.setProject(prev => ({ ...prev, topicName: finalTopic }));
      if (proj.currentNotebook) {
        await fetch(`${gatewayUrl}/notebooks/${proj.currentNotebook.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: finalTopic })
        });
      }
    }
    ui.setIsEditingTopic(false);
  };

  // 3. Initialize Execution Logic (Dependent on Project State)
  const execution = useExecutionLogic({
    project: proj.project,
    setProject: proj.setProject,
    dbReady: proj.dbReady,
    activeModeRef: proj.activeModeRef,
    currentNotebookId: proj.currentNotebook?.id,
    gatewayUrl
  });

  // 4. Initialize AI Logic (Dependent on Project & Execution)
  const aiLogic = useAILogic({
    project: proj.project,
    setProject: proj.setProject,
    userSettings: proj.userSettings,
    activeModeRef: proj.activeModeRef,
    syncSuggestionsToDb,
    handleRun: execution.handleRun
  });

  // 5. Initialize File Upload (Dependent on Project & DB)
  const fileUpload = useFileUpload(
    proj.project.dbName,
    proj.dbReady,
    proj.project.topicName,
    proj.project.tables,
    (newTables) => proj.setProject(prev => ({ ...prev, tables: newTables })),
    handleUpdateTopic
  );

  // Resizing Effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!ui.isResizing) return;
      if (ui.isResizing === 'sidebar') {
         const w = Math.max(200, Math.min(e.clientX, 600)); 
         ui.setSidebarWidth(w);
      } else {
         const w = Math.max(300, Math.min(window.innerWidth - e.clientX, 800)); 
         ui.setRightPanelWidth(w);
      }
    };
    const handleMouseUp = () => ui.setIsResizing(null);

    if (ui.isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none'; 
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [ui.isResizing]);

  // Core Logic to load a notebook's data into the workspace
  const loadNotebookSession = async (nb: Notebook) => {
    const db = getDatabaseEngine();
    const tables = await db.getTables(nb.db_name);

    let initialSuggestions: Suggestion[] = [];
    if (nb.suggestions_json) {
      try {
        initialSuggestions = JSON.parse(nb.suggestions_json);
      } catch (e) {
        console.error("Failed to parse persisted suggestions", e);
      }
    }

    proj.setProject(prev => ({
      ...prev,
      id: nb.id,
      dbName: nb.db_name,
      topicName: nb.topic,
      derivedAppTitle: null,
      tables,
      suggestions: initialSuggestions,
      // GOAL 1: Always default to InsightHub when loading a notebook
      activeMode: DevMode.INSIGHT_HUB 
    }));
    proj.setCurrentNotebook(nb);
    proj.setDbReady(true);
    ui.setLayoutConfig({ showSidebar: true, showHeader: true });
  };

  // Central Routing Logic
  const syncRoute = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const nbId = params.get('nb');
    const appId = params.get('app'); 
    const view = params.get('view');

    // 1. App View
    if (appId) {
       if (!ui.viewingApp || ui.viewingApp.id !== appId) {
           const app = await fetchApp(appId);
           if (app) {
             ui.setViewingApp(app);
             ui.setAppNotFound(false);
           } else {
             ui.setViewingApp(null);
             ui.setAppNotFound(true);
           }
       }
       ui.setIsMarketOpen(false);
       return;
    } else {
       if (ui.viewingApp) ui.setViewingApp(null);
       ui.setAppNotFound(false);
    }

    // 2. Market View
    if (view === 'market') {
       ui.setIsMarketOpen(true);
       return;
    } else {
       ui.setIsMarketOpen(false);
    }

    // 3. Notebook View
    if (nbId) {
       if (proj.currentNotebook?.id === nbId) return;

       try {
           const res = await fetch(`${gatewayUrl}/notebooks`);
           const notebooks = await res.json();
           if (Array.isArray(notebooks)) {
               const found = notebooks.find((n: Notebook) => n.id === nbId);
               if (found) {
                   await loadNotebookSession(found);
               } else {
                   window.history.replaceState({}, '', '/');
                   proj.setCurrentNotebook(null);
                   proj.setDbReady(false);
               }
           }
       } catch (e) {
           console.error("Failed to sync notebook route", e);
       }
    } else {
       // 4. Lobby (Root)
       proj.setCurrentNotebook(null);
       proj.setDbReady(false);
       ui.setViewingApp(null);
       ui.setIsMarketOpen(false);
       ui.setEditingAppId(null);
       ui.setAppNotFound(false);
    }
  }, [proj.currentNotebook, ui.viewingApp, gatewayUrl]);

  // Initial Setup
  useEffect(() => {
    const dbType = (typeof process !== 'undefined' ? process.env.DB_TYPE : 'mysql') || 'mysql';
    const engine = dbType === 'postgres' ? new PostgresEngine() : new MySQLEngine();
    setDatabaseEngine(engine);

    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [syncRoute]);

  const handleFetchSuggestionsWrapper = () => {
      aiLogic.handleFetchSuggestions(ui.setIsSuggesting, (v) => {/* No-op for now unless we add notification state back to UI state */});
  };

  // Auto-fetch suggestions if tables exist but no suggestions
  useEffect(() => {
    if (proj.dbReady && proj.project.tables.length > 0 && proj.project.suggestions.length === 0 && !ui.isSuggesting) {
      handleFetchSuggestionsWrapper();
    }
  }, [proj.dbReady, proj.project.tables.length, proj.project.suggestions.length]);

  const handleOpenNotebook = async (nb: Notebook, urlParams?: Record<string, string>) => {
    await loadNotebookSession(nb);
    const params = new URLSearchParams();
    params.set('nb', nb.id);
    if (urlParams) {
        Object.entries(urlParams).forEach(([k, v]) => params.set(k, v));
    }
    window.history.pushState({}, '', `?${params.toString()}`);
  };

  // Helper to extract state from app snapshot
  const restoreAppState = (app: PublishedApp, prev: ProjectState): ProjectState => {
      let loadedResult = null;
      let loadedAnalysis = '';
      
      if (app.snapshot_json) {
          try {
              const parsed = JSON.parse(app.snapshot_json);
              if (parsed.result) {
                  loadedResult = parsed.result;
                  loadedAnalysis = parsed.analysis || '';
              } else {
                  loadedResult = parsed;
              }
          } catch(e) {}
      }

      const description = (app.description || '').trim();
      const prompt = (app.prompt || '').trim();
      
      let cleanCode = app.code;
      const prefix = app.type === DevMode.SQL ? '--' : '#';
      
      const lines = cleanCode.split('\n');
      const filteredLines = [];
      let isHeader = true;
      
      for (const line of lines) {
          const t = line.trim();
          const isDesc = t.startsWith(`${prefix} Description:`);
          const isPrompt = t.startsWith(`${prefix} Prompt:`);
          
          if (isHeader) {
              if (isDesc || isPrompt) continue;
              if (t === '') continue;
              isHeader = false;
              filteredLines.push(line);
          } else {
              filteredLines.push(line);
          }
      }
      cleanCode = filteredLines.join('\n');

      let commentBlock = '';
      if (description && prompt && description === prompt) {
          commentBlock = `${prefix} Prompt: ${prompt.replace(/\n/g, ' ')}\n\n`;
      } else {
          if (description) commentBlock += `${prefix} Description: ${description.replace(/\n/g, ' ')}\n`;
          if (prompt) commentBlock += `${prefix} Prompt: ${prompt.replace(/\n/g, ' ')}\n`;
          if (commentBlock) commentBlock += '\n';
      }
      
      const codeWithComments = commentBlock + cleanCode;
      const restoredPrompt = (app.prompt || app.description || app.title);

      return {
          ...prev,
          activeMode: app.type,
          sqlCode: app.type === DevMode.SQL ? codeWithComments : prev.sqlCode,
          pythonCode: app.type === DevMode.PYTHON ? codeWithComments : prev.pythonCode,
          sqlAiPrompt: app.type === DevMode.SQL ? restoredPrompt : prev.sqlAiPrompt,
          pythonAiPrompt: app.type === DevMode.PYTHON ? restoredPrompt : prev.pythonAiPrompt,
          lastSqlAiPrompt: app.type === DevMode.SQL ? restoredPrompt : prev.lastSqlAiPrompt,
          lastPythonAiPrompt: app.type === DevMode.PYTHON ? restoredPrompt : prev.lastPythonAiPrompt,
          derivedAppTitle: app.title, 
          lastSqlResult: app.type === DevMode.SQL ? loadedResult : prev.lastSqlResult,
          lastPythonResult: app.type === DevMode.PYTHON ? loadedResult : prev.lastPythonResult,
          analysisReport: loadedAnalysis || prev.analysisReport,
          isAnalyzing: false, 
          isRecommendingCharts: false,
          sqlAiThought: null, 
          pythonAiThought: null,
          previewResult: null
      };
  }

  const loadAppToNotebook = async (app: PublishedApp, mode: 'edit' | 'fork') => {
    if (!app.source_notebook_id) {
        alert("This app was created before the edit feature was enabled, or the source notebook link is missing.");
        return;
    }

    try {
        const res = await fetch(`${gatewayUrl}/notebooks`);
        const notebooks: Notebook[] = await res.json();
        const originalNb = notebooks.find(nb => nb.id === app.source_notebook_id);

        if (originalNb) {
            await handleOpenNotebook(originalNb, { source: mode === 'edit' ? 'app_edit' : 'app_clone', app_id: app.id });
            proj.setProject(prev => restoreAppState(app, prev));
            ui.setEditingAppId(mode === 'edit' ? app.id : null);
            ui.setViewingApp(null);
            ui.setIsMarketOpen(false);
        } else {
            alert("The original notebook seems to have been deleted.");
        }
    } catch (e) {
        alert("Failed to find original notebook.");
    }
  }

  const handleEditApp = (app: PublishedApp) => loadAppToNotebook(app, 'edit');
  const handleForkApp = (app: PublishedApp) => loadAppToNotebook(app, 'fork');

  const handleCloneNotebook = async (app: PublishedApp) => {
      try {
          let suggestionsJson = undefined;
          const newNotebook = await cloneNotebook(
              app.source_db_name,
              `Clone of ${app.title}`,
              suggestionsJson
          );
          await handleOpenNotebook(newNotebook, { source: 'nb_clone', ref_app_id: app.id });
          proj.setProject(prev => restoreAppState(app, prev));
          ui.setEditingAppId(null); 
          ui.setViewingApp(null);
          ui.setIsMarketOpen(false);
      } catch (e: any) {
          alert(`Failed to clone app: ${e.message}`);
      }
  }

  const handleExit = () => {
    proj.setCurrentNotebook(null);
    proj.setDbReady(false);
    ui.setIsMarketOpen(false); 
    ui.setViewingApp(null); 
    ui.setEditingAppId(null);
    ui.setAppNotFound(false);
    ui.setLayoutConfig({ showSidebar: true, showHeader: true });
    window.history.pushState({}, '', '/');
  };
  
  const handleOpenMarket = () => {
      ui.setAppNotFound(false);
      ui.setIsMarketOpen(true);
      window.history.pushState({}, '', '?view=market');
  }

  const handleCloseMarket = () => {
      ui.setIsMarketOpen(false);
      if (proj.currentNotebook) {
          window.history.pushState({}, '', `?nb=${proj.currentNotebook.id}`);
      } else {
          window.history.pushState({}, '', '/');
      }
  }
  
  const handleOpenAppById = async (appId: string) => {
      const app = await fetchApp(appId);
      if (app) {
          ui.setViewingApp(app);
          ui.setAppNotFound(false);
          fetch(`${gatewayUrl}/apps/${appId}/view`, { method: 'POST' }).catch(console.warn);
          window.history.pushState({}, '', `?app=${appId}`); 
      } else {
          ui.setAppNotFound(true);
          window.history.pushState({}, '', `?app=${appId}`); 
      }
  }
  
  const handleCloseAppViewer = () => {
      ui.setViewingApp(null);
      ui.setAppNotFound(false);
      ui.setIsMarketOpen(true);
      window.history.pushState({}, '', '?view=market');
  }

  const handleOpenDatasetPicker = () => {
      ui.setIsLoadingDatasets(true);
      ui.setShowDatasetPicker(true);
      fetch(`${gatewayUrl}/datasets`)
        .then(res => res.json())
        .then(data => proj.setAvailableDatasets(data))
        .catch(console.error)
        .finally(() => ui.setIsLoadingDatasets(false));
  };

  const handleDatasetSelect = async (ds: Dataset) => {
      if (!proj.project.dbName) return;
      ui.setIsLoadingDatasets(true);
      try {
          const res = await fetch(`${gatewayUrl}/datasets/import`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ dbName: proj.project.dbName, datasetId: ds.id })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Import Failed");
          
          const engine = getDatabaseEngine();
          const tables = await engine.getTables(proj.project.dbName);
          proj.setProject(p => ({ ...p, tables }));
          
          if (data.topicName) {
              handleUpdateTopic(data.topicName);
          }
          ui.setShowDatasetPicker(false);
      } catch (e: any) {
          alert(e.message);
      } finally {
          ui.setIsLoadingDatasets(false);
      }
  };

  const handleConnectDatabaseWrapper = async (dbName: string) => {
      if (proj.project.dbName === dbName) {
          ui.setIsConnectDbOpen(false);
          return;
      }

      ui.setIsConnectingDb(true);
      ui.setConnectStatus("Checking existing notebooks...");

      try {
          const res = await fetch(`${gatewayUrl}/notebooks`);
          if (res.ok) {
              const notebooks: Notebook[] = await res.json();
              const existingNb = notebooks.find((nb: Notebook) => nb.db_name === dbName);
              
              if (existingNb) {
                  ui.setConnectStatus("Switching to existing notebook...");
                  await handleOpenNotebook(existingNb);
                  ui.setIsConnectDbOpen(false);
                  ui.setIsConnectingDb(false);
                  return;
              }
          }
      } catch (e) {
          console.warn("Failed to check existing notebooks", e);
      }

      await execution.handleConnectDatabase(
        dbName, 
        ui.setIsConnectingDb, 
        ui.setConnectStatus,
        handleUpdateTopic,
        (db) => proj.setCurrentNotebook(prev => prev ? { ...prev, db_name: db } : null)
      );
  };

  return {
    // UI State
    ...ui,
    
    // Project State
    ...proj,
    
    // File Upload
    isUploading: fileUpload.isUploading,
    uploadProgress: fileUpload.uploadProgress,

    // Actions
    handleOpenNotebook,
    handleEditApp,
    handleForkApp,
    handleCloneNotebook,
    handleExit,
    handleOpenMarket,
    handleCloseMarket,
    handleOpenAppById,
    handleCloseAppViewer,
    handleUpdateTopic,
    handleUpload: fileUpload.handleUpload,
    handleOpenDatasetPicker,
    handleDatasetSelect,
    
    // Execution
    handleRun: execution.handleRun,
    handleColumnAction: execution.handleColumnAction,
    handleConnectDatabase: handleConnectDatabaseWrapper,

    // AI
    handleSqlAiGenerate: aiLogic.handleSqlAiGenerate,
    handlePythonAiGenerate: aiLogic.handlePythonAiGenerate,
    handleDebugSql: aiLogic.handleDebugSql,
    handleDebugPython: aiLogic.handleDebugPython,
    handleFetchSuggestions: handleFetchSuggestionsWrapper,
    handleUpdateSuggestion: aiLogic.handleUpdateSuggestion,
    handleDeleteSuggestion: aiLogic.handleDeleteSuggestion,
    
    // Misc
    hasNewSuggestions: false, // Handled implicitly by side-effects or InsightHub
    setHasNewSuggestions: (v: boolean) => {} 
  };
};
