
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
import DatasetPickerModal from './components/DatasetPickerModal'; // New
import { useFileUpload } from './hooks/useFileUpload';
import { FileQuestion, LayoutGrid } from 'lucide-react';

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
  
  // Publish Dialog State
  const [isPublishOpen, setIsPublishOpen] = useState(false);

  // Dataset Modal State
  const [isDatasetModalOpen, setIsDatasetModalOpen] = useState(false);
  const [availableDatasets, setAvailableDatasets] = useState<Dataset[]>([]);
  const [isCloningDataset, setIsCloningDataset] = useState(false);

  const gatewayUrl = (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';

  const [project, setProject] = useState<ProjectState>({
    id: null,
    dbName: null,
    name: "Enterprise Data Hub",
    topicName: "未命名主题",
    derivedAppTitle: null,
    owner: "Lead Analyst",
    tables: [],
    activeMode: DevMode.SQL,
    sqlCode: INITIAL_SQL,
    pythonCode: INITIAL_PYTHON,
    lastSqlCodeBeforeAi: null,
    lastPythonCodeBeforeAi: null,
    sqlAiPrompt: '',
    pythonAiPrompt: '',
    
    lastSqlAiPrompt: null,
    lastPythonAiPrompt: null,
    
    sqlAiThought: null,
    pythonAiThought: null,

    suggestions: [],
    lastSqlResult: null,
    lastPythonResult: null,
    previewResult: null,
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

  const activeModeRef = useRef(project.activeMode);
  useEffect(() => {
    activeModeRef.current = project.activeMode;
  }, [project.activeMode]);

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
      derivedAppTitle: null,
      tables,
      suggestions: initialSuggestions
    }));
    setCurrentNotebook(nb);
    setDbReady(true);
  };

  const syncRoute = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const nbId = params.get('nb');
    const appId = params.get('app');
    const view = params.get('view');

    if (appId) {
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

    if (view === 'market') {
       setIsMarketOpen(true);
       return;
    } else {
       setIsMarketOpen(false);
    }

    if (nbId) {
       if (currentNotebook?.id === nbId) return;

       try {
           const res = await fetch(`${gatewayUrl}/notebooks`);
           const notebooks = await res.json();
           if (Array.isArray(notebooks)) {
               const found = notebooks.find((n: Notebook) => n.id === nbId);
               if (found) {
                   await loadNotebookSession(found);
               } else {
                   window.history.replaceState({}, '', '/');
                   setCurrentNotebook(null);
                   setDbReady(false);
               }
           }
       } catch (e) {
           console.error("Failed to sync notebook route", e);
       }
    } else {
       setCurrentNotebook(null);
       setDbReady(false);
       setViewingApp(null);
       setIsMarketOpen(false);
       setHasNewSuggestions(false);
       setEditingAppId(null);
       setAppNotFound(false);
    }
  }, [currentNotebook, viewingApp, gatewayUrl]);

  useEffect(() => {
    const engine = new MySQLEngine();
    setDatabaseEngine(engine);
    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [syncRoute]);

  useEffect(() => {
    if (dbReady && project.tables.length > 0 && project.suggestions.length === 0 && !isSuggesting) {
      handleFetchSuggestions();
    }
  }, [dbReady, project.tables.length, project.suggestions.length]);

  const handleOpenNotebook = async (nb: Notebook, urlParams?: Record<string, string>) => {
    await loadNotebookSession(nb);
    const params = new URLSearchParams();
    params.set('nb', nb.id);
    if (urlParams) {
        Object.entries(urlParams).forEach(([k, v]) => params.set(k, v));
    }
    window.history.pushState({}, '', `?${params.toString()}`);
  };

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
            setProject(prev => restoreAppState(app, prev));
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
          const newNotebook = await cloneNotebook(
              app.source_db_name,
              `Clone of ${app.title}`,
              undefined
          );
          await handleOpenNotebook(newNotebook, { source: 'nb_clone', ref_app_id: app.id });
          setProject(prev => restoreAppState(app, prev));
          setEditingAppId(null);
          setViewingApp(null);
          setIsMarketOpen(false);
      } catch (e: any) {
          alert(`Failed to clone app: ${e.message}`);
      }
  }

  const handleExit = () => {
    setCurrentNotebook(null);
    setDbReady(false);
    setHasNewSuggestions(false);
    setIsMarketOpen(false);
    setViewingApp(null);
    setEditingAppId(null);
    setAppNotFound(false);
    window.history.pushState({}, '', '/');
  };
  
  const handleOpenMarket = () => {
      setAppNotFound(false);
      setIsMarketOpen(true);
      window.history.pushState({}, '', '?view=market');
  }

  const handleCloseMarket = () => {
      setIsMarketOpen(false);
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
          fetch(`${gatewayUrl}/apps/${appId}/view`, { method: 'POST' }).catch(console.warn);
          window.history.pushState({}, '', `?app=${appId}`); 
      } else {
          setAppNotFound(true);
          window.history.pushState({}, '', `?app=${appId}`);
      }
  }
  
  const handleCloseAppViewer = () => {
      setViewingApp(null);
      setAppNotFound(false);
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

  const { isUploading, uploadProgress, handleUpload } = useFileUpload(
    project.dbName,
    dbReady,
    project.topicName,
    project.tables,
    (newTables) => setProject(prev => ({ ...prev, tables: newTables })),
    handleUpdateTopic
  );

  const handleOpenDatasetPicker = async () => {
      try {
          const res = await fetch(`${gatewayUrl}/datasets`);
          const data = await res.json();
          setAvailableDatasets(data);
          setIsDatasetModalOpen(true);
      } catch (e) {
          console.error("Failed to load datasets", e);
          alert("Could not load dataset library.");
      }
  };

  const handleImportDataset = async (dataset: Dataset) => {
      if (!project.dbName) return;
      setIsCloningDataset(true);
      try {
          const res = await fetch(`${gatewayUrl}/datasets/import`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dbName: project.dbName, datasetId: dataset.id })
          });
          
          if (!res.ok) throw new Error("Import failed");

          // Refresh Tables
          const engine = getDatabaseEngine();
          const tables = await engine.getTables(project.dbName);
          setProject(prev => ({ ...prev, tables }));
          
          // Update Topic
          handleUpdateTopic(dataset.topicName);
          
          // Close Modal
          setIsDatasetModalOpen(false);
          
          // Trigger Suggestion refresh
          setProject(prev => ({ ...prev, suggestions: [] })); // Clear old
          setTimeout(() => handleFetchSuggestions(), 500);

      } catch (e) {
          console.error(e);
          alert("Failed to clone dataset.");
      } finally {
          setIsCloningDataset(false);
      }
  };

  const handleSqlAiGenerate = async (promptOverride?: string) => {
    const promptToUse = promptOverride || project.sqlAiPrompt;
    if (!promptToUse) return;
    setProject(prev => ({ ...prev, isSqlAiGenerating: true, lastSqlCodeBeforeAi: prev.sqlCode, sqlAiThought: null }));
    try {
      let result;
      const isRefinement = project.sqlCode && project.sqlCode.length > 20 && !project.sqlCode.trim().startsWith("-- Write SQL here");
      if (isRefinement) {
          result = await ai.refineCode(promptToUse, DevMode.SQL, project.tables, project.sqlCode, project.lastSqlResult, project.lastSqlAiPrompt);
      } else {
          result = await ai.generateCode(promptToUse, DevMode.SQL, project.tables);
      }
      setProject(prev => ({ ...prev, sqlCode: result.code, sqlAiThought: result.thought, lastSqlAiPrompt: promptToUse, isSqlAiGenerating: false }));
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
      const isRefinement = project.pythonCode && project.pythonCode.length > 20 && !project.pythonCode.trim().startsWith("# Write Python here");
      if (isRefinement) {
          result = await ai.refineCode(promptToUse, DevMode.PYTHON, project.tables, project.pythonCode, project.lastPythonResult, project.lastPythonAiPrompt);
      } else {
          result = await ai.generateCode(promptToUse, DevMode.PYTHON, project.tables);
      }
      setProject(prev => ({ ...prev, pythonCode: result.code, pythonAiThought: result.thought, lastPythonAiPrompt: promptToUse, isPythonAiGenerating: false }));
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
      setProject(prev => ({ ...prev, sqlCode: code, sqlAiThought: thought, isSqlAiFixing: false }));
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
      setProject(prev => ({ ...prev, pythonCode: code, pythonAiThought: thought, isPythonAiFixing: false }));
      handleRun(code);
    } catch (err) {
      setProject(prev => ({ ...prev, isPythonAiFixing: false }));
    }
  };

  const handleRun = async (codeOverride?: string) => {
    if (!dbReady || !project.dbName) return; 
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
        result = { data: data.data || [], columns: data.columns || [], logs: data.logs || [], plotlyData: data.plotlyData, timestamp: new Date().toLocaleTimeString(), isError: !response.ok };
      }
      setProject(prev => ({ ...prev, isExecuting: false, [currentMode === DevMode.SQL ? 'lastSqlResult' : 'lastPythonResult']: result, isAnalyzing: currentMode === DevMode.SQL && result.data.length > 0 && !result.isError }));
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
      const errorResult: ExecutionResult = { data: [], columns: [], logs: [err.message || "Unknown error occurred during execution"], isError: true, timestamp: new Date().toLocaleTimeString() };
      setProject(prev => ({ ...prev, isExecuting: false, isRecommendingCharts: false, isAnalyzing: false, [currentMode === DevMode.SQL ? 'lastSqlResult' : 'lastPythonResult']: errorResult }));
    }
  };

  const handleFetchSuggestions = async () => {
    if (isSuggesting || project.tables.length === 0) return;
    setIsSuggesting(true);
    try {
      const newSuggestions = await ai.generateSuggestions(project.tables, project.topicName, project.suggestions);
      const updatedSuggestions = [...project.suggestions, ...newSuggestions];
      setProject(prev => ({ ...prev, suggestions: updatedSuggestions }));
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
        <p className="text-sm text-gray-500 font-medium mb-8 text-center max-w-xs leading-relaxed">The app you are looking for might have been deleted or the link is invalid.</p>
        <button onClick={handleOpenMarket} className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 text-xs uppercase tracking-widest"><LayoutGrid size={16} />Browse Marketplace</button>
      </div>
    );
  }

  if (viewingApp) return <AppViewer app={viewingApp} onClose={handleCloseAppViewer} onHome={handleExit} onEdit={handleEditApp} onFork={handleForkApp} onClone={handleCloneNotebook} />;
  if (isMarketOpen) return <AppMarket onClose={handleCloseMarket} onHome={handleExit} onOpenApp={handleOpenAppById} onEditApp={handleEditApp} onCloneApp={handleForkApp} />;
  if (!dbReady && !currentNotebook) return <Lobby onOpen={(nb) => handleOpenNotebook(nb)} onOpenMarket={handleOpenMarket} />;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <AppHeader topicName={project.topicName} isEditing={isEditingTopic} tempTopic={tempTopic} onTempTopicChange={setTempTopic} onEditStart={() => { setTempTopic(project.topicName); setIsEditingTopic(true); }} onEditSubmit={() => { handleUpdateTopic(tempTopic); setIsEditingTopic(false); }} onEditCancel={() => setIsEditingTopic(false)} onExit={handleExit} isNotebookSession={!!currentNotebook} activeMode={project.activeMode} onModeChange={(mode) => { setProject(p => ({ ...p, activeMode: mode })); if (mode === DevMode.INSIGHT_HUB) setHasNewSuggestions(false); }} hasNewSuggestions={hasNewSuggestions} />
      <div className="flex-1 flex overflow-hidden">
        <DataSidebar tables={project.tables} onUploadFile={handleUpload} onRefreshTableStats={async t => { /* same logic */ }} isUploading={isUploading} uploadProgress={uploadProgress} onLoadSample={handleOpenDatasetPicker} />
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
             {project.activeMode === DevMode.INSIGHT_HUB && <InsightHub suggestions={project.suggestions} onApply={(s) => { setProject(p => ({ ...p, activeMode: s.type, [s.type === DevMode.SQL ? 'sqlAiPrompt' : 'pythonAiPrompt']: s.prompt })); if (s.type === DevMode.SQL) handleSqlAiGenerate(s.prompt); else handlePythonAiGenerate(s.prompt); }} onUpdate={handleUpdateSuggestion} onDelete={handleDeleteSuggestion} onFetchMore={handleFetchSuggestions} isLoading={isSuggesting} />}
             {project.activeMode === DevMode.SQL && <SqlWorkspace code={project.sqlCode} onCodeChange={v => setProject(p => ({ ...p, sqlCode: v }))} prompt={project.sqlAiPrompt} onPromptChange={v => setProject(p => ({ ...p, sqlAiPrompt: v }))} result={project.lastSqlResult} previewResult={project.previewResult} onRun={() => handleRun()} isExecuting={project.isExecuting} isAiGenerating={project.isSqlAiGenerating} isAiFixing={project.isSqlAiFixing} onTriggerAi={() => handleSqlAiGenerate()} onDebug={handleDebugSql} tables={project.tables} onUndo={() => setProject(p => ({ ...p, sqlCode: p.lastSqlCodeBeforeAi || INITIAL_SQL }))} showUndo={!!project.lastSqlCodeBeforeAi} aiThought={project.sqlAiThought} />}
             {project.activeMode === DevMode.PYTHON && <PythonWorkspace code={project.pythonCode} onCodeChange={v => setProject(p => ({ ...p, pythonCode: v }))} prompt={project.pythonAiPrompt} onPromptChange={v => setProject(p => ({ ...p, pythonAiPrompt: v }))} result={project.lastPythonResult} previewResult={project.previewResult} onRun={() => handleRun()} isExecuting={project.isExecuting} isAiGenerating={project.isPythonAiGenerating} isAiFixing={project.isPythonAiFixing} onTriggerAi={() => handlePythonAiGenerate()} onDebug={handleDebugPython} tables={project.tables} onUndo={() => setProject(p => ({ ...p, pythonCode: p.lastPythonCodeBeforeAi || INITIAL_PYTHON }))} showUndo={!!project.lastPythonCodeBeforeAi} aiThought={project.pythonAiThought} />}
          </div>
        </main>
        {project.activeMode === DevMode.SQL && <SqlPublishPanel result={project.lastSqlResult} analysis={project.analysisReport} isAnalyzing={project.isAnalyzing} isRecommendingCharts={project.isRecommendingCharts} onDeploy={() => setIsPublishOpen(true)} isDeploying={false} />}
        {project.activeMode === DevMode.PYTHON && <PythonPublishPanel result={project.lastPythonResult} onDeploy={async () => setIsPublishOpen(true)} isDeploying={false} />}
      </div>
      <PublishDialog isOpen={isPublishOpen} onClose={() => setIsPublishOpen(false)} onOpenApp={handleOpenAppById} editingAppId={editingAppId} type={project.activeMode === DevMode.SQL ? DevMode.SQL : DevMode.PYTHON} code={project.activeMode === DevMode.SQL ? project.sqlCode : project.pythonCode} dbName={project.dbName} sourceNotebookId={project.id} resultSnapshot={project.activeMode === DevMode.SQL ? project.lastSqlResult : project.lastPythonResult} defaultTitle={project.derivedAppTitle || project.topicName} defaultDescription={project.activeMode === DevMode.SQL ? project.sqlAiPrompt : project.pythonAiPrompt} sourcePrompt={project.activeMode === DevMode.SQL ? project.sqlAiPrompt : project.pythonAiPrompt} analysisReport={project.analysisReport} />
      
      <DatasetPickerModal 
        isOpen={isDatasetModalOpen}
        onClose={() => setIsDatasetModalOpen(false)}
        onSelect={handleImportDataset}
        isLoading={isCloningDataset}
        datasets={availableDatasets}
      />
    </div>
  );
};

export default App;
