
import React, { useState, useEffect } from 'react';
import { DevMode, ProjectState, TableMetadata, ExecutionResult, Suggestion } from './types';
import { INITIAL_SQL, INITIAL_PYTHON, SI_ENABLE_AI_CHART } from './constants';
import * as ai from './services/aiProvider';
import { setDatabaseEngine, getDatabaseEngine } from './services/dbService';
import { MySQLEngine } from './services/mysqlEngine';
import DataSidebar from './components/DataSidebar';
import SqlWorkspace from './components/SqlWorkspace';
import PythonWorkspace from './components/PythonWorkspace';
import PublishPanel from './components/PublishPanel';
import AppMarket from './components/AppMarket';
import InsightHub from './components/InsightHub';
import { Boxes, LayoutGrid, Loader2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const env = {
    MYSQL_IP: (typeof process !== 'undefined' && process.env.MYSQL_IP) || '127.0.0.1',
    MYSQL_PORT: (typeof process !== 'undefined' && process.env.MYSQL_PORT) || '3306',
    MYSQL_DB: (typeof process !== 'undefined' && process.env.MYSQL_DB) || 'test',
    AI_PROVIDER: (typeof process !== 'undefined' && process.env.AI_PROVIDER) || 'aliyun',
    GATEWAY_URL: (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001'
  };

  const [project, setProject] = useState<ProjectState>({
    name: "Enterprise Data Hub",
    owner: "Lead Analyst",
    tables: [],
    activeMode: DevMode.SQL,
    sqlCode: INITIAL_SQL,
    pythonCode: INITIAL_PYTHON,
    sqlAiPrompt: '',
    pythonAiPrompt: '',
    suggestions: [],
    lastSqlResult: null,
    lastPythonResult: null,
    isExecuting: false,
    isDeploying: false,
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
      setProject(prev => ({ ...prev, suggestions: [...prev.suggestions, ...newSuggestions] }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleApplySuggestion = (s: Suggestion) => {
    setProject(prev => ({
      ...prev,
      activeMode: s.type,
      [s.type === DevMode.SQL ? 'sqlAiPrompt' : 'pythonAiPrompt']: s.prompt
    }));
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
      } catch (err: any) {
        alert("Upload failed: " + err.message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleRefreshTableStats = async (tableName: string) => {
    try {
      const db = getDatabaseEngine();
      const count = await db.refreshTableStats(tableName);
      setProject(prev => ({
        ...prev,
        tables: prev.tables.map(t => t.tableName === tableName ? { ...t, rowCount: count } : t)
      }));
    } catch (err: any) {
      alert("Refresh failed: " + err.message);
    }
  };

  const handleRun = async () => {
    if (!dbReady) return;
    setProject(prev => ({ ...prev, isExecuting: true }));
    
    try {
      let result: ExecutionResult;
      if (project.activeMode === DevMode.SQL) {
        const db = getDatabaseEngine();
        result = await db.executeQuery(project.sqlCode);
        
        const [report, chartConfigs] = await Promise.all([
          result.data.length > 0 ? ai.generateAnalysis(project.sqlCode, result.data) : "SQL executed successfully.",
          (SI_ENABLE_AI_CHART && result.data.length > 0) ? ai.recommendCharts(project.sqlCode, result.data) : Promise.resolve([])
        ]);

        setProject(prev => ({ 
          ...prev, 
          lastSqlResult: { ...result, chartConfigs }, 
          isExecuting: false, 
          analysisReport: report 
        }));
      } else {
        const response = await fetch(`${env.GATEWAY_URL}/python`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: project.pythonCode }),
          signal: AbortSignal.timeout(60000)
        });
        const data = await response.json();
        result = {
          data: data.data || [],
          columns: data.columns || [],
          logs: data.logs || [],
          plotlyData: data.plotlyData || null,
          timestamp: data.timestamp || new Date().toLocaleTimeString()
        };
        
        if (SI_ENABLE_AI_CHART && result.data.length > 0) {
          result.chartConfigs = await ai.recommendCharts(project.pythonCode, result.data);
        }

        setProject(prev => ({ ...prev, lastPythonResult: result, isExecuting: false }));
      }
    } catch (err: any) {
      const errorResult: ExecutionResult = {
        data: [],
        columns: [],
        logs: ["CRITICAL ERROR:", err.message],
        timestamp: new Date().toLocaleTimeString()
      };
      setProject(prev => ({ ...prev, [project.activeMode === DevMode.SQL ? 'lastSqlResult' : 'lastPythonResult']: errorResult, isExecuting: false }));
    }
  };

  const handleDeploy = async () => {
    setProject(prev => ({ ...prev, isDeploying: true }));
    await new Promise(resolve => setTimeout(resolve, 1500));
    setProject(prev => ({ ...prev, isDeploying: false }));
  };

  if (dbError) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-8">
        <AlertCircle size={32} className="text-red-500 mb-6" />
        <h1 className="text-2xl font-black mb-2">Connection Failed</h1>
        <p className="text-gray-500 mb-8">{dbError}</p>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold">Retry</button>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white gap-6">
        <Loader2 className="animate-spin text-blue-600" size={64} />
        <h1 className="text-2xl font-black">Initializing SeekInsight...</h1>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 selection:bg-blue-100 relative">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 z-20 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
               <Boxes className="text-white" size={22} />
            </div>
            <div>
              <h1 className="font-black text-gray-900 text-xl tracking-tighter uppercase">SeekInsight</h1>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Live Cloud Connection</p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-100"></div>
          <div className="px-4 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-700">
            {project.name}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMarketOpen(true)} className="flex items-center gap-2 px-5 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold">
            <LayoutGrid size={16} /> Marketplace
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-800">{project.owner}</span>
            <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black">LA</div>
          </div>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <DataSidebar tables={project.tables} onUploadFile={handleUpload} onRefreshTableStats={handleRefreshTableStats} isUploading={isUploading} />
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="px-8 pt-4 flex items-center gap-10 border-b border-gray-50 bg-white">
            {[
              { id: DevMode.INSIGHT_HUB, label: 'Insight Hub', icon: <Sparkles size={14} className="mr-1" /> },
              { id: DevMode.SQL, label: 'SQL Editor' },
              { id: DevMode.PYTHON, label: 'Python Scripting' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setProject(prev => ({ ...prev, activeMode: tab.id }))}
                className={`pb-4 text-sm font-black transition-all relative flex items-center ${
                  project.activeMode === tab.id ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.icon}{tab.label}
                {project.activeMode === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"></div>}
              </button>
            ))}
          </div>
          {project.activeMode === DevMode.INSIGHT_HUB ? (
            <InsightHub suggestions={project.suggestions} onApply={handleApplySuggestion} onFetchMore={handleFetchSuggestions} isLoading={isSuggesting} />
          ) : project.activeMode === DevMode.SQL ? (
            <SqlWorkspace code={project.sqlCode} onCodeChange={(val) => setProject(p => ({ ...p, sqlCode: val }))} prompt={project.sqlAiPrompt} onPromptChange={(val) => setProject(p => ({ ...p, sqlAiPrompt: val }))} result={project.lastSqlResult} onRun={handleRun} isExecuting={project.isExecuting} tables={project.tables} />
          ) : (
            <PythonWorkspace code={project.pythonCode} onCodeChange={(val) => setProject(p => ({ ...p, pythonCode: val }))} prompt={project.pythonAiPrompt} onPromptChange={(val) => setProject(p => ({ ...p, pythonAiPrompt: val }))} result={project.lastPythonResult} onRun={handleRun} isExecuting={project.isExecuting} tables={project.tables} />
          )}
        </main>
        {project.activeMode !== DevMode.INSIGHT_HUB && (
          <PublishPanel mode={project.activeMode as any} result={project.activeMode === DevMode.SQL ? project.lastSqlResult : project.lastPythonResult} analysis={project.analysisReport} onDeploy={handleDeploy} isDeploying={project.isDeploying} />
        )}
      </div>
    </div>
  );
};

export default App;
