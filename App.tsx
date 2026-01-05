
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DevMode, ProjectState, ExecutionResult, Suggestion, Notebook, PublishedApp, Dataset } from './types';
import { INITIAL_SQL, INITIAL_PYTHON } from './constants';
import * as ai from './services/aiProvider';
import { setDatabaseEngine, getDatabaseEngine } from './services/dbService';
import { fetchApp, cloneNotebook } from './services/appService';
import { MySQLEngine } from './services/mysqlEngine';
import DataSidebar from './components/DataSidebar';
import SqlWorkspace from './components/SqlWorkspace';
import PythonWorkspace from './components/PythonWorkspace';
import SqlPublishPanel from './components/SqlPublishPanel';
import PythonPublishPanel from './components/PythonPublishPanel';
import AppMarket from './components/AppMarket';
import InsightHub from './components/InsightHub';
import PublishDialog from './components/PublishDialog';
import AppViewer from './components/AppViewer';
import Lobby from './components/Lobby';
import AppHeader from './components/AppHeader';
import DatasetPickerModal from './components/DatasetPickerModal'; 
import SettingsModal, { UserSettings } from './components/SettingsModal';
import { useFileUpload } from './hooks/useFileUpload';
import { FileQuestion, LayoutGrid } from 'lucide-react';

const USER_ID = '0'; // Default user ID for MVP

const App: React.FC = () => {
  const [currentNotebook, setCurrentNotebook] = useState<Notebook | null>(null);
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [viewingApp, setViewingApp] = useState<PublishedApp | null>(null);
  const [appNotFound, setAppNotFound] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  
  const [dbReady, setDbReady] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [hasNewSuggestions, setHasNewSuggestions] = useState(false);
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [tempTopic, setTempTopic] = useState("");
  
  const gatewayUrl = (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';

  // User Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings>({ autoExecute: false });

  // Load Settings on Mount
  useEffect(() => {
      fetch(`${gatewayUrl}/settings/${USER_ID}`)
        .then(res => res.json())
        .then(data => setUserSettings(data))
        .catch(console.error);
  }, [gatewayUrl]);

  const updateUserSettings = async (key: keyof UserSettings, value: boolean) => {
    const newSettings = { ...userSettings, [key]: value };
    setUserSettings(newSettings); // Optimistic update
    try {
        await fetch(`${gatewayUrl}/settings/${USER_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSettings)
        });
    } catch(e) {
        console.error("Failed to save settings", e);
    }
  };

  // Publish Dialog State
  const [isPublishOpen, setIsPublishOpen] = useState(false);

  // Dataset Picker State
  const [showDatasetPicker, setShowDatasetPicker] = useState(false);
  const [availableDatasets, setAvailableDatasets] = useState<Dataset[]>([]);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);

  // Panel Resizing State
  const [sidebarWidth, setSidebarWidth] = useState(288); // Default w-72 (18rem)
  const [rightPanelWidth, setRightPanelWidth] = useState(384); // Default w-96 (24rem)
  const [isResizing, setIsResizing] = useState<'sidebar' | 'right' | null>(null);

  const [project, setProject] = useState<ProjectState>({
    id: null,
    dbName: null,
    name: "Enterprise Data Hub",
    topicName: "未命名主题",
    derivedAppTitle: null, // Initialize
    owner: "Lead Analyst",
    tables: [],
    activeMode: DevMode.SQL,
    sqlCode: INITIAL_SQL,
    pythonCode: INITIAL_PYTHON,
    lastSqlCodeBeforeAi: null,
    lastPythonCodeBeforeAi: null,
    sqlAiPrompt: '',
    pythonAiPrompt: '',
    
    // Track History
    lastSqlAiPrompt: null,
    lastPythonAiPrompt: null,
    
    sqlAiThought: null, // Initialize
    pythonAiThought: null, // Initialize

    suggestions: [],
    lastSqlResult: null,
    lastPythonResult: null,
    previewResult: null, // Initialize
    isExecuting: false,
    isAnalyzing: false,
    isRecommendingCharts: false,
    isDeploying: false,
    isSqlAiGenerating: false,
    isSqlAiFixing: false,
    isPythonAiGenerating: false,
    isPythonAiFixing: false,
    analysisReport: '',
    visualConfig: { chartType: 'bar' }
  } as ProjectState);

  // Track activeMode in ref to avoid stale closures in async callbacks
  const activeModeRef = useRef(project.activeMode);
  useEffect(() => {
    activeModeRef.current = project.activeMode;
  }, [project.activeMode]);

  // Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      if (isResizing === 'sidebar') {
         const w = Math.max(200, Math.min(e.clientX, 600)); // Min 200, Max 600
         setSidebarWidth(w);
      } else {
         const w = Math.max(300, Math.min(window.innerWidth - e.clientX, 800)); // Min 300, Max 800
         setRightPanelWidth(w);
      }
    };
    const handleMouseUp = () => setIsResizing(null);

    if (isResizing) {
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
  }, [isResizing]);

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

    setProject(prev => ({
      ...prev,
      id: nb.id,
      dbName: nb.db_name,
      topicName: nb.topic,
      derivedAppTitle: null, // Reset derived title when switching notebooks
      tables,
      suggestions: initialSuggestions
    }));
    setCurrentNotebook(nb);
    setDbReady(true);
  };

  // Central Routing Logic to Sync State with URL
  const syncRoute = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const nbId = params.get('nb');
    const appId = params.get('app'); // Changed from 'id' to 'app'
    const view = params.get('view');

    // 1. App View
    if (appId) {
       // Only fetch if strictly needed to avoid flicker
       if (!viewingApp || viewingApp.id !== appId) {
           const app = await fetchApp(appId);
           if (app) {
             setViewingApp(app);
             setAppNotFound(false);
           } else {
             setViewingApp(null);
             setAppNotFound(true);
           }
       }
       setIsMarketOpen(false);
       return;
    } else {
       if (viewingApp) setViewingApp(null);
       setAppNotFound(false);
    }

    // 2. Market View
    if (view === 'market') {
       setIsMarketOpen(true);
       return;
    } else {
       setIsMarketOpen(false);
    }

    // 3. Notebook View
    if (nbId) {
       // If already loaded, do nothing
       if (currentNotebook?.id === nbId) return;

       try {
           const res = await fetch(`${gatewayUrl}/notebooks`);
           const notebooks = await res.json();
           if (Array.isArray(notebooks)) {
               const found = notebooks.find((n: Notebook) => n.id === nbId);
               if (found) {
                   await loadNotebookSession(found);
               } else {
                   // Notebook not found, redirect to lobby
                   window.history.replaceState({}, '', '/');
                   setCurrentNotebook(null);
                   setDbReady(false);
               }
           }
       } catch (e) {
           console.error("Failed to sync notebook route", e);
       }
    } else {
       // 4. Lobby (Root)
       setCurrentNotebook(null);
       setDbReady(false);
       setViewingApp(null);
       setIsMarketOpen(false);
       setHasNewSuggestions(false);
       setEditingAppId(null);
       setAppNotFound(false);
    }
  }, [currentNotebook, viewingApp, gatewayUrl]);

  // Initial Setup & Popstate Listener
  useEffect(() => {
    const engine = new MySQLEngine();
    setDatabaseEngine(engine);

    // Initial sync
    syncRoute();

    // Listen for Back/Forward buttons
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [syncRoute]);

  useEffect(() => {
    if (dbReady && project.tables.length > 0 && project.suggestions.length === 0 && !isSuggesting) {
      handleFetchSuggestions();
    }
  }, [dbReady, project.tables.length, project.suggestions.length]);

  const handleOpenNotebook = async (nb: Notebook, urlParams?: Record<string, string>) => {
    // Optimistically set state
    await loadNotebookSession(nb);
    
    // Construct URL Params
    const params = new URLSearchParams();
    params.set('nb', nb.id);
    if (urlParams) {
        Object.entries(urlParams).forEach(([k, v]) => params.set(k, v));
    }

    // Push history
    window.history.pushState({}, '', `?${params.toString()}`);
  };

  // Helper to extract state from app snapshot
  const restoreAppState = (app: PublishedApp, prev: ProjectState): ProjectState => {
      // Note: We DO NOT inject SI_PARAMS schema back into the code. 
      // The source code should remain clean. The schema will be regenerated upon running the script.

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

      // Format Comments for Code Editor
      const description = (app.description || '').trim();
      const prompt = (app.prompt || '').trim();
      
      // --- CLEAN UP OLD SYSTEM COMMENTS (Idempotency Fix) ---
      let cleanCode = app.code;
      const prefix = app.type === DevMode.SQL ? '--' : '#';
      
      const lines = cleanCode.split('\n');
      const filteredLines = [];
      let isHeader = true;
      
      for (const line of lines) {
          const t = line.trim();
          // Identify system-generated metadata lines (Robust check)
          const isDesc = t.startsWith(`${prefix} Description:`);
          const isPrompt = t.startsWith(`${prefix} Prompt:`);
          
          if (isHeader) {
              if (isDesc || isPrompt) {
                  // Skip system comment
                  continue;
              }
              // Skip leading empty lines
              if (t === '') {
                  continue;
              }
              // Found user code or user comments, header processing ends
              isHeader = false;
              filteredLines.push(line);
          } else {
              filteredLines.push(line);
          }
      }
      cleanCode = filteredLines.join('\n');
      // -----------------------------------------------------

      let commentBlock = '';

      // Avoid duplication if description is identical to prompt (default state)
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
          // Inject comments into code
          sqlCode: app.type === DevMode.SQL ? codeWithComments : prev.sqlCode,
          pythonCode: app.type === DevMode.PYTHON ? codeWithComments : prev.pythonCode,
          // Use stored prompt if available, fallback to description/title
          sqlAiPrompt: app.type === DevMode.SQL ? restoredPrompt : prev.sqlAiPrompt,
          pythonAiPrompt: app.type === DevMode.PYTHON ? restoredPrompt : prev.pythonAiPrompt,
          
          // Also set history state so subsequent refinements have context
          lastSqlAiPrompt: app.type === DevMode.SQL ? restoredPrompt : prev.lastSqlAiPrompt,
          lastPythonAiPrompt: app.type === DevMode.PYTHON ? restoredPrompt : prev.lastPythonAiPrompt,
          
          derivedAppTitle: app.title, // Priority: Store original app title

          lastSqlResult: app.type === DevMode.SQL ? loadedResult : prev.lastSqlResult,
          lastPythonResult: app.type === DevMode.PYTHON ? loadedResult : prev.lastPythonResult,
          analysisReport: loadedAnalysis || prev.analysisReport,
          isAnalyzing: false, // Reset loading states
          isRecommendingCharts: false,
          sqlAiThought: null, // Clear thought when restoring
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
            // Updated: Pass source and app_id for logging/analytics
            await handleOpenNotebook(originalNb, { source: mode === 'edit' ? 'app_edit' : 'app_clone', app_id: app.id });
            
            // Restore code/prompt/results on top of the opened notebook state
            setProject(prev => restoreAppState(app, prev));
            
            // Critical difference: 'edit' sets editingAppId, 'fork' clears it (creating a new app)
            setEditingAppId(mode === 'edit' ? app.id : null);

            setViewingApp(null);
            setIsMarketOpen(false);
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
          // Restore code/prompt/results on top of the new notebook state
          setProject(prev => restoreAppState(app, prev));

          setEditingAppId(null); // Ensure we are creating a new app ID from this new notebook
          setViewingApp(null);
          setIsMarketOpen(false);
      } catch (e: any) {
          alert(`Failed to clone app: ${e.message}`);
      }
  }

  const handleExit = () => {
    // Reset State
    setCurrentNotebook(null);
    setDbReady(false);
    setHasNewSuggestions(false);
    setIsMarketOpen(false); // Fix: Force close market
    setViewingApp(null); // Fix: Force close app viewer
    setEditingAppId(null);
    setAppNotFound(false);
    // Push history
    window.history.pushState({}, '', '/');
  };
  
  const handleOpenMarket = () => {
      setAppNotFound(false);
      setIsMarketOpen(true);
      window.history.pushState({}, '', '?view=market');
  }

  const handleCloseMarket = () => {
      setIsMarketOpen(false);
      // Determine where to go back to based on current state
      if (currentNotebook) {
          window.history.pushState({}, '', `?nb=${currentNotebook.id}`);
      } else {
          window.history.pushState({}, '', '/');
      }
  }
  
  const handleOpenAppById = async (appId: string) => {
      const app = await fetchApp(appId);
      if (app) {
          setViewingApp(app);
          setAppNotFound(false);
          // Also increment view here if coming directly from URL, though ideally API handles dedup or gateway call
          fetch(`${gatewayUrl}/apps/${appId}/view`, { method: 'POST' }).catch(console.warn);
          window.history.pushState({}, '', `?app=${appId}`); 
      } else {
          setAppNotFound(true);
          window.history.pushState({}, '', `?app=${appId}`); // Keep URL to show error for this specific ID
      }
  }
  
  const handleCloseAppViewer = () => {
      setViewingApp(null);
      setAppNotFound(false);
      // Usually apps are viewed from Market, so return to market
      setIsMarketOpen(true);
      window.history.pushState({}, '', '?view=market');
  }

  const syncSuggestionsToDb = async (suggestions: Suggestion[]) => {
    if (!currentNotebook) return;
    try {
      await fetch(`${gatewayUrl}/notebooks/${currentNotebook.id}`, {
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
      setIsEditingTopic(false);
      return;
    }
    
    const finalTopic = trimmed.substring(0, 30);
    
    if (finalTopic !== project.topicName) {
      setProject(prev => ({ ...prev, topicName: finalTopic }));
      if (currentNotebook) {
        await fetch(`${gatewayUrl}/notebooks/${currentNotebook.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: finalTopic })
        });
      }
    }
    
    setIsEditingTopic(false);
  };

  // Use the new Hook for File Upload
  const { isUploading, uploadProgress, handleUpload } = useFileUpload(
    project.dbName,
    dbReady,
    project.topicName,
    project.tables,
    (newTables) => setProject(prev => ({ ...prev, tables: newTables })),
    handleUpdateTopic
  );

  // --- Sample Dataset Logic ---
  const handleOpenDatasetPicker = () => {
      setIsLoadingDatasets(true);
      setShowDatasetPicker(true);
      fetch(`${gatewayUrl}/datasets`)
        .then(res => res.json())
        .then(data => setAvailableDatasets(data))
        .catch(console.error)
        .finally(() => setIsLoadingDatasets(false));
  };

  const handleDatasetSelect = async (ds: Dataset) => {
      if (!project.dbName) return;
      setIsLoadingDatasets(true);
      try {
          const res = await fetch(`${gatewayUrl}/datasets/import`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ dbName: project.dbName, datasetId: ds.id })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Import Failed");
          
          // Refresh tables
          const engine = getDatabaseEngine();
          const tables = await engine.getTables(project.dbName);
          setProject(p => ({ ...p, tables }));
          
          // Update Topic
          if (data.topicName) {
              handleUpdateTopic(data.topicName);
          }
          
          setShowDatasetPicker(false);
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsLoadingDatasets(false);
      }
  };
  // -----------------------------

  const handleColumnAction = (action: 'fulltext' | 'embedding', tableName: string, columnName: string) => {
      setProject(prev => {
          let newSqlCode = prev.sqlCode;
          if (action === 'fulltext') {
              newSqlCode = prev.sqlCode + `\n\n-- Create Full Text Index\nCREATE FULLTEXT INDEX \`idx_${tableName}_${columnName}\` ON \`${tableName}\`(\`${columnName}\`);\n`;
          } else if (action === 'embedding') {
              newSqlCode = prev.sqlCode + `\n\n/* \n  TODO: Generate Vector Embeddings \n  Model: text-embedding-v1\n  Source: ${tableName}.${columnName}\n*/\n-- ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}_vector\` VECTOR(768);\n-- UPDATE \`${tableName}\` SET \`${columnName}_vector\` = VECTOR_EMBEDDING('${columnName}');\n`;
          }
          
          return {
              ...prev,
              activeMode: DevMode.SQL, // Switch to SQL to execute
              sqlCode: newSqlCode
          };
      });
  };

  const handleSqlAiGenerate = async (promptOverride?: string) => {
    const promptToUse = promptOverride || project.sqlAiPrompt;
    if (!promptToUse) return;
    
    setProject(prev => ({ ...prev, isSqlAiGenerating: true, lastSqlCodeBeforeAi: prev.sqlCode, sqlAiThought: null }));
    
    try {
      let result;
      // Heuristic: If code is longer than 20 chars and doesn't look like default comment
      const isRefinement = project.sqlCode && project.sqlCode.length > 20 && !project.sqlCode.trim().startsWith("-- Write SQL here");
      
      if (isRefinement) {
          result = await ai.refineCode(
              promptToUse, 
              DevMode.SQL, 
              project.tables, 
              project.sqlCode, 
              project.lastSqlResult,
              project.lastSqlAiPrompt // Pass context history
          );
      } else {
          result = await ai.generateCode(promptToUse, DevMode.SQL, project.tables);
      }

      setProject(prev => ({ 
          ...prev, 
          sqlCode: result.code, 
          sqlAiThought: result.thought, // Store thought
          lastSqlAiPrompt: promptToUse, // Update context history
          isSqlAiGenerating: false 
      }));

      // Auto Execute if enabled
      if (userSettings.autoExecute) {
          handleRun(result.code);
      }

    } catch (err) {
      setProject(prev => ({ ...prev, isSqlAiGenerating: false }));
    }
  };

  const handlePythonAiGenerate = async (promptOverride?: string) => {
    const promptToUse = promptOverride || project.pythonAiPrompt;
    if (!promptToUse) return;
    
    setProject(prev => ({ ...prev, isPythonAiGenerating: true, lastPythonCodeBeforeAi: prev.pythonCode, pythonAiThought: null }));
    
    try {
      let result;
      // Heuristic: If code is longer than 20 chars and doesn't look like default comment
      const isRefinement = project.pythonCode && project.pythonCode.length > 20 && !project.pythonCode.trim().startsWith("# Write Python here");

      if (isRefinement) {
          result = await ai.refineCode(
              promptToUse, 
              DevMode.PYTHON, 
              project.tables, 
              project.pythonCode, 
              project.lastPythonResult,
              project.lastPythonAiPrompt // Pass context history
          );
      } else {
          result = await ai.generateCode(promptToUse, DevMode.PYTHON, project.tables);
      }

      setProject(prev => ({ 
          ...prev, 
          pythonCode: result.code, 
          pythonAiThought: result.thought, // Store thought
          lastPythonAiPrompt: promptToUse, // Update context history
          isPythonAiGenerating: false 
      }));

      // Auto Execute if enabled
      if (userSettings.autoExecute) {
          handleRun(result.code);
      }

    } catch (err) {
      setProject(prev => ({ ...prev, isPythonAiGenerating: false }));
    }
  };

  const handleDebugSql = async () => {
    if (!project.lastSqlResult?.isError || !project.sqlCode) return;
    setProject(prev => ({ ...prev, isSqlAiFixing: true, sqlAiThought: null }));
    try {
      const logs = project.lastSqlResult.logs?.join('\n') || '';
      const { code, thought } = await ai.debugCode(project.sqlAiPrompt, DevMode.SQL, project.tables, project.sqlCode, logs);
      setProject(prev => ({ 
          ...prev, 
          sqlCode: code, 
          sqlAiThought: thought, // Store fix thought
          isSqlAiFixing: false 
      }));
      handleRun(code);
    } catch (err) {
      setProject(prev => ({ ...prev, isSqlAiFixing: false }));
    }
  };

  const handleDebugPython = async () => {
    if (!project.lastPythonResult?.isError || !project.pythonCode) return;
    setProject(prev => ({ ...prev, isPythonAiFixing: true, pythonAiThought: null }));
    try {
      const logs = project.lastPythonResult.logs?.join('\n') || '';
      const { code, thought } = await ai.debugCode(project.pythonAiPrompt, DevMode.PYTHON, project.tables, project.pythonCode, logs);
      setProject(prev => ({ 
          ...prev, 
          pythonCode: code, 
          pythonAiThought: thought, // Store fix thought
          isPythonAiFixing: false 
      }));
      handleRun(code);
    } catch (err) {
      setProject(prev => ({ ...prev, isPythonAiFixing: false }));
    }
  };

  const handleRun = async (codeOverride?: string) => {
    if (!dbReady || !project.dbName) return; 
    
    // Clear preview when running manual code to show actual results
    setProject(prev => ({ ...prev, isExecuting: true, previewResult: null }));
    
    const currentMode = project.activeMode;
    const currentCode = codeOverride || (currentMode === DevMode.SQL ? project.sqlCode : project.pythonCode);
    
    try {
      let result: ExecutionResult;
      if (currentMode === DevMode.SQL) {
        result = await getDatabaseEngine().executeQuery(currentCode, project.dbName);
      } else {
        const response = await fetch(`${gatewayUrl}/python`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: currentCode, dbName: project.dbName })
        });
        const data = await response.json();
        result = { 
          data: data.data || [], 
          columns: data.columns || [], 
          logs: data.logs || [], 
          plotlyData: data.plotlyData, 
          timestamp: new Date().toLocaleTimeString(), 
          isError: !response.ok 
        };
      }
      setProject(prev => ({
        ...prev,
        isExecuting: false,
        [currentMode === DevMode.SQL ? 'lastSqlResult' : 'lastPythonResult']: result,
        isAnalyzing: currentMode === DevMode.SQL && result.data.length > 0 && !result.isError
      }));
      if (currentMode === DevMode.SQL && result.data.length > 0 && !result.isError) {
        ai.generateAnalysis(currentCode, result.data, project.topicName, project.sqlAiPrompt).then(report => {
          setProject(prev => ({ ...prev, analysisReport: report, isAnalyzing: false }));
        });
        setProject(prev => ({ ...prev, isRecommendingCharts: true }));
        ai.recommendCharts(currentCode, result.data).then(charts => {
          setProject(prev => ({ ...prev, lastSqlResult: { ...result, chartConfigs: charts }, isRecommendingCharts: false }));
        });
      }
    } catch (err: any) {
      if (process.env.SI_DEBUG_MODE !== 'false') {
        console.error(`[Execution Error - ${currentMode}]:`, err);
      }
      
      const errorResult: ExecutionResult = {
        data: [],
        columns: [],
        logs: [err.message || "Unknown error occurred during execution"],
        isError: true,
        timestamp: new Date().toLocaleTimeString()
      };

      setProject(prev => ({ 
        ...prev, 
        isExecuting: false, 
        isRecommendingCharts: false, 
        isAnalyzing: false,
        [currentMode === DevMode.SQL ? 'lastSqlResult' : 'lastPythonResult']: errorResult
      }));
    }
  };

  const handleFetchSuggestions = async () => {
    if (isSuggesting || project.tables.length === 0) return;
    setIsSuggesting(true);
    try {
      const newSuggestions = await ai.generateSuggestions(project.tables, project.topicName, project.suggestions);
      const updatedSuggestions = [...project.suggestions, ...newSuggestions];
      setProject(prev => ({ ...prev, suggestions: updatedSuggestions }));
      
      // Use Ref to check CURRENT active mode, not the one when function started
      if (activeModeRef.current !== DevMode.INSIGHT_HUB) {
        setHasNewSuggestions(true);
      }

      syncSuggestionsToDb(updatedSuggestions);
    } finally { setIsSuggesting(false); }
  };

  const handleUpdateSuggestion = (id: string, newPrompt: string) => {
    const updated = project.suggestions.map(s => s.id === id ? { ...s, prompt: newPrompt } : s);
    setProject(prev => ({ ...prev, suggestions: updated }));
    syncSuggestionsToDb(updated);
  };

  const handleDeleteSuggestion = (id: string) => {
    const updated = project.suggestions.filter(s => s.id !== id);
    setProject(prev => ({ ...prev, suggestions: updated }));
    syncSuggestionsToDb(updated);
  };

  if (appNotFound) {
    return (
      <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
        <div className="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-gray-100">
          <FileQuestion size={40} className="text-gray-300" /> 
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">App Not Found</h2>
        <p className="text-sm text-gray-500 font-medium mb-8 text-center max-w-xs leading-relaxed">
          The app you are looking for might have been deleted or the link is invalid.
        </p>
        <button 
          onClick={handleOpenMarket}
          className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 text-xs uppercase tracking-widest"
        >
          <LayoutGrid size={16} />
          Browse Marketplace
        </button>
      </div>
    );
  }

  if (viewingApp) {
      return (
          <AppViewer 
             app={viewingApp}
             onClose={handleCloseAppViewer}
             onHome={handleExit}
             onEdit={handleEditApp}
             onFork={handleForkApp} // Pass handleForkApp here
             onClone={handleCloneNotebook} 
          />
      );
  }

  if (isMarketOpen) {
      return (
         <AppMarket 
            onClose={handleCloseMarket}
            onHome={handleExit}
            onOpenApp={handleOpenAppById}
            onEditApp={handleEditApp}
            onCloneApp={handleForkApp} 
         />
      );
  }

  if (!dbReady && !currentNotebook) return <Lobby onOpen={(nb) => handleOpenNotebook(nb)} onOpenMarket={handleOpenMarket} />;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <AppHeader
        topicName={project.topicName}
        isEditing={isEditingTopic}
        tempTopic={tempTopic}
        onTempTopicChange={setTempTopic}
        onEditStart={() => { setTempTopic(project.topicName); setIsEditingTopic(true); }}
        onEditSubmit={() => { handleUpdateTopic(tempTopic); setIsEditingTopic(false); }}
        onEditCancel={() => setIsEditingTopic(false)}
        onExit={handleExit}
        isNotebookSession={!!currentNotebook}
        activeMode={project.activeMode}
        onModeChange={(mode) => {
            setProject(p => ({ ...p, activeMode: mode }));
            if (mode === DevMode.INSIGHT_HUB) setHasNewSuggestions(false); 
        }}
        hasNewSuggestions={hasNewSuggestions}
        sidebarWidth={sidebarWidth} // Dynamically adjust width
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <DataSidebar
          tables={project.tables}
          onUploadFile={handleUpload}
          onRefreshTableStats={async t => {
            try {
              if (project.dbName) {
                const engine = getDatabaseEngine();
                // 1. Refresh Row Count
                const count = await engine.refreshTableStats(t, project.dbName);
                
                // 2. Fetch Preview Data (System Preview)
                // This non-invasively loads sample data into the project state
                // without executing Python or SQL explicitly in the editor
                const previewRes = await engine.executeQuery(`SELECT * FROM \`${t}\` LIMIT 10`, project.dbName);
                
                // 3. Refresh Schema (Columns)
                const latestTables = await engine.getTables(project.dbName);
                const freshMetadata = latestTables.find(tbl => tbl.tableName === t);

                setProject(prev => ({
                    ...prev,
                    previewResult: previewRes, // Set Preview Data
                    tables: prev.tables.map(table =>
                    table.tableName === t ? { 
                        ...table, 
                        rowCount: count,
                        columns: freshMetadata ? freshMetadata.columns : table.columns
                    } : table
                    )
                }));
              }
            } catch (e: any) {
               const msg = e.message || "";
               if (msg.includes("doesn't exist") || msg.includes("no such table")) {
                  setProject(prev => ({
                    ...prev,
                    tables: prev.tables.filter(table => table.tableName !== t)
                  }));
               } else {
                 console.error("Refresh failed", e);
               }
            }
          }}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          onLoadSample={handleOpenDatasetPicker} 
          width={sidebarWidth} // Pass dynamic width
          onColumnAction={handleColumnAction} // Connect the context menu handler
        />
        
        {/* Left Resizer Handle */}
        <div
          className="w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-50 bg-transparent -ml-0.5 flex-shrink-0"
          onMouseDown={() => setIsResizing('sidebar')}
        />

        <main className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
          <div className="flex-1 flex flex-col overflow-hidden">
             {project.activeMode === DevMode.INSIGHT_HUB && (
              <InsightHub
                suggestions={project.suggestions}
                onApply={(s) => {
                  setProject(p => ({ ...p, activeMode: s.type, [s.type === DevMode.SQL ? 'sqlAiPrompt' : 'pythonAiPrompt']: s.prompt }));
                  if (s.type === DevMode.SQL) handleSqlAiGenerate(s.prompt);
                  else handlePythonAiGenerate(s.prompt);
                }}
                onUpdate={handleUpdateSuggestion}
                onDelete={handleDeleteSuggestion}
                onFetchMore={handleFetchSuggestions}
                isLoading={isSuggesting}
              />
             )}
             {project.activeMode === DevMode.SQL && (
              <SqlWorkspace
                code={project.sqlCode}
                onCodeChange={v => setProject(p => ({ ...p, sqlCode: v }))}
                prompt={project.sqlAiPrompt}
                onPromptChange={v => setProject(p => ({ ...p, sqlAiPrompt: v }))}
                result={project.lastSqlResult}
                previewResult={project.previewResult} // Pass Preview Result
                onRun={() => handleRun()}
                isExecuting={project.isExecuting}
                isAiGenerating={project.isSqlAiGenerating}
                isAiFixing={project.isSqlAiFixing}
                onTriggerAi={() => handleSqlAiGenerate()}
                onDebug={handleDebugSql}
                tables={project.tables}
                onUndo={() => setProject(p => ({ ...p, sqlCode: p.lastSqlCodeBeforeAi || INITIAL_SQL }))}
                showUndo={!!project.lastSqlCodeBeforeAi}
                aiThought={project.sqlAiThought} // Pass Thought
              />
             )}
             {project.activeMode === DevMode.PYTHON && (
              <PythonWorkspace
                code={project.pythonCode}
                onCodeChange={v => setProject(p => ({ ...p, pythonCode: v }))}
                prompt={project.pythonAiPrompt}
                onPromptChange={v => setProject(p => ({ ...p, pythonAiPrompt: v }))}
                result={project.lastPythonResult}
                previewResult={project.previewResult} // Pass temporary preview
                onRun={() => handleRun()}
                isExecuting={project.isExecuting}
                isAiGenerating={project.isPythonAiGenerating}
                isAiFixing={project.isPythonAiFixing}
                onTriggerAi={() => handlePythonAiGenerate()}
                onDebug={handleDebugPython}
                tables={project.tables}
                onUndo={() => setProject(p => ({ ...p, pythonCode: p.lastPythonCodeBeforeAi || INITIAL_PYTHON }))}
                showUndo={!!project.lastPythonCodeBeforeAi}
                aiThought={project.pythonAiThought} // Pass Thought
              />
             )}
          </div>
        </main>

        {(project.activeMode === DevMode.SQL || project.activeMode === DevMode.PYTHON) && (
             // Right Resizer Handle
             <div
                className="w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-50 bg-transparent -mr-0.5 flex-shrink-0"
                onMouseDown={() => setIsResizing('right')}
             />
        )}

        {project.activeMode === DevMode.SQL && (
            <SqlPublishPanel 
                result={project.lastSqlResult} 
                analysis={project.analysisReport} 
                isAnalyzing={project.isAnalyzing} 
                isRecommendingCharts={project.isRecommendingCharts} 
                onDeploy={() => setIsPublishOpen(true)} 
                isDeploying={false} 
                width={rightPanelWidth} // Pass dynamic width
            />
        )}
        {project.activeMode === DevMode.PYTHON && (
            <PythonPublishPanel 
                result={project.lastPythonResult} 
                onDeploy={async () => setIsPublishOpen(true)} 
                isDeploying={false} 
                width={rightPanelWidth} // Pass dynamic width
            />
        )}
      </div>
      
      <PublishDialog 
         isOpen={isPublishOpen} 
         onClose={() => setIsPublishOpen(false)}
         onOpenApp={handleOpenAppById}
         editingAppId={editingAppId} // Pass ID to distinguish update vs create
         type={project.activeMode === DevMode.SQL ? DevMode.SQL : DevMode.PYTHON}
         code={project.activeMode === DevMode.SQL ? project.sqlCode : project.pythonCode}
         dbName={project.dbName}
         sourceNotebookId={project.id}
         resultSnapshot={project.activeMode === DevMode.SQL ? project.lastSqlResult : project.lastPythonResult}
         // Updated Logic: Use derivedAppTitle if available (from Edit/Fork flow), otherwise fallback to topicName
         defaultTitle={project.derivedAppTitle || project.topicName}
         defaultDescription={project.activeMode === DevMode.SQL ? project.sqlAiPrompt : project.pythonAiPrompt}
         sourcePrompt={project.activeMode === DevMode.SQL ? project.sqlAiPrompt : project.pythonAiPrompt} // Pass original prompt
         analysisReport={project.analysisReport}
      />

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={userSettings}
        onUpdate={updateUserSettings}
      />

      {/* Dataset Picker Modal */}
      <DatasetPickerModal 
        isOpen={showDatasetPicker}
        onClose={() => setShowDatasetPicker(false)}
        onSelect={handleDatasetSelect}
        isLoading={isLoadingDatasets}
        datasets={availableDatasets}
      />
    </div>
  );
};

export default App;
