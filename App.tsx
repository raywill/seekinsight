
import React, { useState, useEffect, useRef } from 'react';
import { DevMode, ProjectState, ExecutionResult, Suggestion } from './types';
import { INITIAL_SQL, INITIAL_PYTHON } from './constants';
import * as ai from './services/aiProvider';
import { setDatabaseEngine, getDatabaseEngine } from './services/dbService';
import { MySQLEngine } from './services/mysqlEngine';
import DataSidebar from './components/DataSidebar';
import SqlWorkspace from './components/SqlWorkspace';
import PythonWorkspace from './components/PythonWorkspace';
import SqlPublishPanel from './components/SqlPublishPanel';
import PythonPublishPanel from './components/PythonPublishPanel';
import AppMarket from './components/AppMarket';
import InsightHub from './components/InsightHub';
import { Boxes, LayoutGrid, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [hasUnreadSuggestions, setHasUnreadSuggestions] = useState(false);

  // Request trackers for cancellation/overriding
  const sqlReqId = useRef(0);
  const pythonReqId = useRef(0);

  const env = {
    MYSQL_IP: (typeof process !== 'undefined' && process.env.MYSQL_IP) || '127.0.0.1',
    MYSQL_PORT: (typeof process !== 'undefined' && process.env.MYSQL_PORT) || '3306',
    MYSQL_DB: (typeof process !== 'undefined' && process.env.MYSQL_DB) || 'test',
    GATEWAY_URL: (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001'
  };

  const [project, setProject] = useState<ProjectState>({
    name: "Enterprise Data Hub",
    owner: "Lead Analyst",
    tables: [],
    activeMode: DevMode.SQL,
    sqlCode: INITIAL_SQL,
    pythonCode: INITIAL_PYTHON,
    lastSqlCodeBeforeAi: null,
    lastPythonCodeBeforeAi: null,
    sqlAiPrompt: '',
    pythonAiPrompt: '',
    suggestions: [],
    lastSqlResult: null,
    lastPythonResult: null,
    isExecuting: false,
    isAnalyzing: false,
    isRecommendingCharts: false,
    isDeploying: false,
    isSqlAiGenerating: false,
    isPythonAiGenerating: false,
    analysisReport: '',
    visualConfig: { chartType: 'bar' }
  } as ProjectState);

  useEffect(() => {
    let mounted = true;
    const engine = new MySQLEngine();
    engine.init()
      .then(async () => {
        if (!mounted) return;
        setDatabaseEngine(engine);
        const tables = await engine.getTables();
        setProject(prev => ({ ...prev, tables }));
        setDbReady(true);
      })
      .catch((err) => {
        if (!mounted) return;
        setDbError(err.message || "Failed to connect to SQL Gateway");
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (project.suggestions.length === 0 && project.tables.length > 0 && dbReady) {
      handleFetchSuggestions();
    }
  }, [project.tables.length, dbReady]);

  const handleFetchSuggestions = async () => {
    if (isSuggesting || project.tables.length === 0) return;
    setIsSuggesting(true);
    try {
      const newSuggestions = await ai.generateSuggestions(project.tables);
      
      // Safety: Ensure all incoming suggestions have unique IDs to prevent React key issues
      const salt = Date.now().toString(36);
      const uniqueNewSuggestions = newSuggestions.map((s, idx) => ({
        ...s,
        id: `${s.id || 'suggestion'}_${salt}_${idx}`
      }));

      setProject(prev => {
        // If we are currently NOT on Insight Hub, mark as unread
        if (prev.activeMode !== DevMode.INSIGHT_HUB) {
          setHasUnreadSuggestions(true);
        }
        return { 
          ...prev, 
          suggestions: [...prev.suggestions, ...uniqueNewSuggestions] 
        };
      });
    } catch (err) { console.error(err); } 
    finally { setIsSuggesting(false); }
  };

  const handleTriggerAiCode = async (mode: DevMode, prompt: string) => {
    if (!prompt.trim()) return;

    const isSql = mode === DevMode.SQL;
    const currentId = ++(isSql ? sqlReqId : pythonReqId).current;

    setProject(prev => ({ 
      ...prev, 
      [isSql ? 'isSqlAiGenerating' : 'isPythonAiGenerating']: true,
      [isSql ? 'lastSqlCodeBeforeAi' : 'lastPythonCodeBeforeAi']: isSql ? prev.sqlCode : prev.pythonCode
    }));

    try {
      const generated = await ai.generateCode(prompt, mode, project.tables);
      
      // Only apply if this is still the latest request for this mode
      if (currentId === (isSql ? sqlReqId : pythonReqId).current) {
        setProject(prev => ({
          ...prev,
          [isSql ? 'sqlCode' : 'pythonCode']: generated,
          [isSql ? 'isSqlAiGenerating' : 'isPythonAiGenerating']: false
        }));
      }
    } catch (err) {
      console.error("AI Generation Error:", err);
      if (currentId === (isSql ? sqlReqId : pythonReqId).current) {
        setProject(prev => ({ ...prev, [isSql ? 'isSqlAiGenerating' : 'isPythonAiGenerating']: false }));
      }
    }
  };

  const handleDebugCode = async (mode: DevMode) => {
    const isSql = mode === DevMode.SQL;
    const currentId = ++(isSql ? sqlReqId : pythonReqId).current;
    const currentCode = isSql ? project.sqlCode : project.pythonCode;
    const currentPrompt = isSql ? project.sqlAiPrompt : project.pythonAiPrompt;
    const lastResult = isSql ? project.lastSqlResult : project.lastPythonResult;
    const errorMessage = lastResult?.logs?.join('\n') || "Unknown error during execution.";

    setProject(prev => ({ 
      ...prev, 
      [isSql ? 'isSqlAiGenerating' : 'isPythonAiGenerating']: true,
      [isSql ? 'lastSqlCodeBeforeAi' : 'lastPythonCodeBeforeAi']: isSql ? prev.sqlCode : prev.pythonCode
    }));

    try {
      const generated = await ai.debugCode(currentPrompt, mode, project.tables, currentCode, errorMessage);
      
      if (currentId === (isSql ? sqlReqId : pythonReqId).current) {
        setProject(prev => ({
          ...prev,
          [isSql ? 'sqlCode' : 'pythonCode']: generated,
          [isSql ? 'isSqlAiGenerating' : 'isPythonAiGenerating']: false
        }));
        // Auto run after debug
        setTimeout(() => handleRun(), 100);
      }
    } catch (err) {
      console.error("AI Debug Error:", err);
      if (currentId === (isSql ? sqlReqId : pythonReqId).current) {
        setProject(prev => ({ ...prev, [isSql ? 'isSqlAiGenerating' : 'isPythonAiGenerating']: false }));
      }
    }
  };

  const handleApplySuggestion = (s: Suggestion) => {
    // 1. Switch tab and prepare prompt immediately
    setProject(prev => ({
      ...prev,
      activeMode: s.type,
      [s.type === DevMode.SQL ? 'sqlAiPrompt' : 'pythonAiPrompt']: s.prompt,
    }));
    
    // 2. Trigger the automated generation
    handleTriggerAiCode(s.type, s.prompt);
  };

  const handleUndoAi = (mode: DevMode) => {
    setProject(prev => {
      if (mode === DevMode.SQL) {
        return { ...prev, sqlCode: prev.lastSqlCodeBeforeAi || prev.sqlCode, lastSqlCodeBeforeAi: null };
      } else {
        return { ...prev, pythonCode: prev.lastPythonCodeBeforeAi || prev.pythonCode, lastPythonCodeBeforeAi: null };
      }
    });
  };

  const handleUpload = async (file: File) => {
    if (!dbReady || isUploading) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
        const tableName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
        const aiComments = await ai.inferColumnMetadata(tableName, jsonData);
        const db = getDatabaseEngine();
        const newTable = await db.createTableFromData(tableName, jsonData, aiComments);
        setProject(prev => ({ ...prev, tables: [...prev.tables.filter(t => t.tableName !== newTable.tableName), newTable] }));
      } catch (err: any) { alert("Upload failed: " + err.message); } 
      finally { setIsUploading(false); }
    };
    reader.readAsBinaryString(file);
  };

  const handleRefreshTableStats = async (tableName: string) => {
    const db = getDatabaseEngine();
    const count = await db.refreshTableStats(tableName);
    setProject(prev => ({
      ...prev,
      tables: prev.tables.map(t => t.tableName === tableName ? { ...t, rowCount: count } : t)
    }));
  };

  const handleRun = async () => {
    if (!dbReady) return;
    const currentMode = project.activeMode;
    const currentCode = currentMode === DevMode.SQL ? project.sqlCode : project.pythonCode;

    setProject(prev => ({ ...prev, isExecuting: true, isAnalyzing: false, isRecommendingCharts: false, analysisReport: '' }));
    try {
      let result: ExecutionResult;

      if (currentMode === DevMode.SQL) {
        result = await getDatabaseEngine().executeQuery(currentCode);
      } else {
        const response = await fetch(`${env.GATEWAY_URL}/python`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: currentCode })
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
        isAnalyzing: currentMode === DevMode.SQL && result.data.length > 0
      }));

      // Trigger AI features if SQL returned data
      if (currentMode === DevMode.SQL && result.data.length > 0) {
        // Trigger Analysis
        ai.generateAnalysis(currentCode, result.data).then(report => {
          setProject(prev => ({ ...prev, analysisReport: report, isAnalyzing: false }));
        });

        // Trigger Chart Recommendations
        setProject(prev => ({ ...prev, isRecommendingCharts: true }));
        ai.recommendCharts(currentCode, result.data).then(charts => {
          setProject(prev => ({
            ...prev,
            lastSqlResult: { ...result, chartConfigs: charts },
            isRecommendingCharts: false
          }));
        });
      }
    } catch (err: any) {
      console.error("Execution Error:", err);
      const errorResult: ExecutionResult = {
        data: [],
        columns: [],
        logs: [err.message || "Unknown error during execution."],
        timestamp: new Date().toLocaleTimeString(),
        isError: true
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

  const handleDeploy = async () => {
    setProject(prev => ({ ...prev, isDeploying: true }));
    await new Promise(r => setTimeout(r, 1500));
    setProject(prev => ({ ...prev, isDeploying: false }));
  };

  const handleTabChange = (tabId: DevMode) => {
    if (tabId === DevMode.INSIGHT_HUB) {
      setHasUnreadSuggestions(false);
    }
    setProject(prev => ({ ...prev, activeMode: tabId }));
  };

  if (dbError) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-8 text-center">
      <AlertCircle size={32} className="text-red-500 mb-4" />
      <h1 className="text-xl font-black">Connection Error</h1>
      <p className="text-gray-500 mb-8">{dbError}</p>
      <button onClick={() => window.location.reload()} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold">Retry</button>
    </div>
  );

  if (!dbReady) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white gap-6">
      <Loader2 className="animate-spin text-blue-600" size={64} />
      <h1 className="text-2xl font-black">Connecting Cluster...</h1>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg"><Boxes className="text-white" size={22} /></div>
          <div><h1 className="font-black text-gray-900 text-xl tracking-tighter uppercase">SeekInsight</h1><p className="text-[9px] font-bold text-gray-400 uppercase">Live Cloud</p></div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMarketOpen(true)} className="flex items-center gap-2 px-5 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold"><LayoutGrid size={16} /> Market</button>
          <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black">LA</div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <DataSidebar tables={project.tables} onUploadFile={handleUpload} onRefreshTableStats={handleRefreshTableStats} isUploading={isUploading} />
        
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="px-8 pt-4 flex items-center gap-10 border-b border-gray-50">
            {[
              { id: DevMode.INSIGHT_HUB, label: 'Insight Hub', icon: <Sparkles size={14} className="mr-1" /> }, 
              { id: DevMode.SQL, label: 'SQL Editor' }, 
              { id: DevMode.PYTHON, label: 'Python Scripting' }
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => handleTabChange(tab.id)} 
                className={`pb-4 text-sm font-black relative flex items-center transition-all ${project.activeMode === tab.id ? 'text-blue-600' : 'text-gray-400'}`}
              >
                {tab.icon}{tab.label}
                {tab.id === DevMode.INSIGHT_HUB && hasUnreadSuggestions && (
                  <div className="absolute top-0 -right-1.5 w-2 h-2 bg-[#ff4d4f] rounded-full border border-white shadow-sm ring-1 ring-[#ff4d4f]/20"></div>
                )}
                {project.activeMode === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"></div>}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {project.activeMode === DevMode.INSIGHT_HUB && (
              <InsightHub suggestions={project.suggestions} onApply={handleApplySuggestion} onFetchMore={handleFetchSuggestions} isLoading={isSuggesting} />
            )}
            {project.activeMode === DevMode.SQL && (
              <SqlWorkspace 
                code={project.sqlCode} onCodeChange={v => setProject(p => ({ ...p, sqlCode: v }))} 
                prompt={project.sqlAiPrompt} onPromptChange={v => setProject(p => ({ ...p, sqlAiPrompt: v }))} 
                result={project.lastSqlResult} onRun={handleRun} isExecuting={project.isExecuting} 
                isAiLoading={project.isSqlAiGenerating}
                onTriggerAi={() => handleTriggerAiCode(DevMode.SQL, project.sqlAiPrompt)}
                onDebug={() => handleDebugCode(DevMode.SQL)}
                tables={project.tables} onUndo={() => handleUndoAi(DevMode.SQL)} showUndo={!!project.lastSqlCodeBeforeAi}
              />
            )}
            {project.activeMode === DevMode.PYTHON && (
              <PythonWorkspace 
                code={project.pythonCode} onCodeChange={v => setProject(p => ({ ...p, pythonCode: v }))} 
                prompt={project.pythonAiPrompt} onPromptChange={v => setProject(p => ({ ...p, pythonAiPrompt: v }))} 
                result={project.lastPythonResult} onRun={handleRun} isExecuting={project.isExecuting} 
                isAiLoading={project.isPythonAiGenerating}
                onTriggerAi={() => handleTriggerAiCode(DevMode.PYTHON, project.pythonAiPrompt)}
                onDebug={() => handleDebugCode(DevMode.PYTHON)}
                tables={project.tables} onUndo={() => handleUndoAi(DevMode.PYTHON)} showUndo={!!project.lastPythonCodeBeforeAi}
              />
            )}
          </div>
        </main>

        {project.activeMode === DevMode.SQL && (
          <SqlPublishPanel 
            result={project.lastSqlResult} 
            analysis={project.analysisReport} 
            isAnalyzing={project.isAnalyzing} 
            isRecommendingCharts={project.isRecommendingCharts}
            onDeploy={handleDeploy} 
            isDeploying={project.isDeploying} 
          />
        )}
        {project.activeMode === DevMode.PYTHON && (
          <PythonPublishPanel result={project.lastPythonResult} onDeploy={handleDeploy} isDeploying={project.isDeploying} />
        )}
      </div>
      {isMarketOpen && <AppMarket onClose={() => setIsMarketOpen(false)} />}
    </div>
  );
};

export default App;
