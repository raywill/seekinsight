
import React, { useState, useEffect } from 'react';
import { DevMode, ProjectState, TableMetadata, ExecutionResult } from './types';
import { INITIAL_SQL, INITIAL_PYTHON } from './constants';
import * as ai from './services/aiProvider';
import { setDatabaseEngine, getDatabaseEngine } from './services/dbService';
import { MySQLEngine } from './services/mysqlEngine';
import DataSidebar from './components/DataSidebar';
import EditorPanel from './components/EditorPanel';
import ResultPanel from './components/ResultPanel';
import PublishPanel from './components/PublishPanel';
import AppMarket from './components/AppMarket';
import { Boxes, LayoutGrid, Loader2, AlertCircle, Database, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const env = {
    MYSQL_IP: (typeof process !== 'undefined' && process.env.MYSQL_IP) || '127.0.0.1',
    MYSQL_PORT: (typeof process !== 'undefined' && process.env.MYSQL_PORT) || '3306',
    MYSQL_DB: (typeof process !== 'undefined' && process.env.MYSQL_DB) || 'test',
    AI_PROVIDER: (typeof process !== 'undefined' && process.env.AI_PROVIDER) || 'aliyun'
  };

  const [project, setProject] = useState<ProjectState>({
    name: "Enterprise Data Hub",
    owner: "Lead Analyst",
    tables: [],
    activeMode: DevMode.SQL,
    sqlCode: INITIAL_SQL,
    pythonCode: INITIAL_PYTHON,
    lastResult: null,
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
        console.error("Database Connection Failed:", err);
        setDbError(err.message || "Failed to connect to SQL Gateway");
      });

    return () => { mounted = false; };
  }, []);

  const handleUpload = async (file: File) => {
    if (!dbReady || isUploading) return;
    setIsUploading(true);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
        
        const tableName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
        const aiComments = await ai.inferColumnMetadata(tableName, jsonData);
        
        const db = getDatabaseEngine();
        const newTable = await db.createTableFromData(tableName, jsonData, aiComments);
        
        setProject(prev => ({ 
          ...prev, 
          tables: [...prev.tables.filter(t => t.tableName !== newTable.tableName), newTable] 
        }));
      } catch (err: any) {
        console.error("Upload Error:", err);
        alert("Upload failed: " + err.message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      alert("Failed to read file");
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
      console.error("Refresh Stats Error:", err);
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
      } else {
        // Real Python execution via Gateway
        const response = await fetch('http://localhost:3001/python', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: project.pythonCode })
        });
        
        const data = await response.json();
        if (!response.ok) {
           throw new Error(data.logs?.join('\n') || "Python execution failed");
        }
        
        result = {
          data: data.data || [],
          columns: data.columns || [],
          logs: data.logs || [],
          timestamp: data.timestamp || new Date().toLocaleTimeString()
        };
      }

      const report = result.data.length > 0 
        ? await ai.generateAnalysis(project.activeMode === DevMode.SQL ? project.sqlCode : "Python Script", result.data) 
        : "Execution finished with no visual results to analyze.";

      setProject(prev => ({ ...prev, lastResult: result, isExecuting: false, analysisReport: report }));
    } catch (err: any) {
      console.error("Execution Error:", err);
      alert("Execution Error: " + err.message);
      setProject(prev => ({ ...prev, isExecuting: false }));
    }
  };

  const handleDeploy = async () => {
    setProject(prev => ({ ...prev, isDeploying: true }));
    await new Promise(resolve => setTimeout(resolve, 1500));
    setProject(prev => ({ ...prev, isDeploying: false }));
  };

  const setCode = (val: string) => {
    setProject(prev => ({
      ...prev,
      [project.activeMode === DevMode.SQL ? 'sqlCode' : 'pythonCode']: val
    }));
  };

  if (dbError) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-8 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-red-100">
           <AlertCircle size={32} />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Connection Failed</h1>
        <p className="text-gray-500 max-w-md font-medium mb-8 leading-relaxed">
          Unable to connect to the SQL Gateway. Please ensure <code>gateway.js</code> is running and environment variables are correctly set.
        </p>
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-mono break-all text-left border border-red-100 mb-8 max-w-lg">
          {dbError}
        </div>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold transition-transform active:scale-95 shadow-lg">Retry Connection</button>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white gap-6">
        <Loader2 className="animate-spin text-blue-600" size={64} strokeWidth={1} />
        <div className="text-center">
           <h1 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Initializing SeekInsight</h1>
           <p className="text-xs text-gray-400 font-bold uppercase mt-1 tracking-widest">Establishing secure tunnel to database</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 selection:bg-blue-100 selection:text-blue-900 relative">
      {isUploading && (
        <div className="fixed inset-0 z-[1000] bg-gray-900/10 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white px-8 py-6 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-5 max-w-sm">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <RefreshCw size={20} className="animate-spin" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-gray-800 tracking-tight">Syncing Data</h2>
              <p className="text-[11px] text-gray-400 font-medium leading-normal mt-0.5">
                Parsing worksheets and generating AI metadata, please wait...
              </p>
            </div>
          </div>
        </div>
      )}

      {isMarketOpen && <AppMarket onClose={() => setIsMarketOpen(false)} />}
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 z-20 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-2xl shadow-blue-200">
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
          <button onClick={() => setIsMarketOpen(true)} className="flex items-center gap-2 px-5 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold transition-all hover:bg-blue-100">
            <LayoutGrid size={16} /> Marketplace
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-800">{project.owner}</span>
            <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black">LA</div>
          </div>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <DataSidebar 
          tables={project.tables} 
          onUploadFile={handleUpload} 
          onRefreshTableStats={handleRefreshTableStats}
          isUploading={isUploading} 
        />
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="px-8 pt-4 flex items-center gap-10 border-b border-gray-50">
            {['SQL Editor', 'Python Scripting'].map((label, i) => (
              <button
                key={label}
                onClick={() => setProject(prev => ({ ...prev, activeMode: i === 0 ? DevMode.SQL : DevMode.PYTHON }))}
                className={`pb-4 text-sm font-black transition-all relative ${
                  (i === 0 && project.activeMode === DevMode.SQL) || (i === 1 && project.activeMode === DevMode.PYTHON) ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
                {((i === 0 && project.activeMode === DevMode.SQL) || (i === 1 && project.activeMode === DevMode.PYTHON)) && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"></div>}
              </button>
            ))}
          </div>
          <EditorPanel 
            mode={project.activeMode} 
            code={project.activeMode === DevMode.SQL ? project.sqlCode : project.pythonCode}
            onCodeChange={setCode}
            onRun={handleRun}
            isExecuting={project.isExecuting}
            tables={project.tables}
          />
          <ResultPanel mode={project.activeMode} result={project.lastResult} isLoading={project.isExecuting} />
        </main>
        <PublishPanel mode={project.activeMode} result={project.lastResult} analysis={project.analysisReport} onDeploy={handleDeploy} isDeploying={project.isDeploying} />
      </div>
      <footer className="h-10 bg-gray-50 border-t border-gray-100 px-8 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-widest">
        <div className="flex items-center gap-6">
          <span className="text-green-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>Host: {env.MYSQL_IP}</span>
          <span>Port: {env.MYSQL_PORT}</span>
        </div>
        <div className="flex gap-8">
          <span>AI Provider: {env.AI_PROVIDER.toUpperCase()}</span>
          <span>Database: {env.MYSQL_DB} ({project.tables.length} Objects)</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
