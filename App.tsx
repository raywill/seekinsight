
import React, { useState, useEffect, useRef } from 'react';
import { DevMode, ProjectState, ExecutionResult, Suggestion, Notebook, TableMetadata } from './types';
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
import { Boxes, LayoutGrid, Loader2, Sparkles, PencilLine, Check, X, ArrowRight, Trash2, Calendar, LogOut, Plus, Database } from 'lucide-react';
import * as Icons from 'lucide-react';
import * as XLSX from 'xlsx';

const Lobby: React.FC<{ onOpen: (nb: Notebook) => void }> = ({ onOpen }) => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const gatewayUrl = (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';

  const fetchNotebooks = () => {
    fetch(`${gatewayUrl}/notebooks`)
      .then(res => {
        if (!res.ok) throw new Error("Gateway Error");
        return res.json();
      })
      .then(data => {
        setNotebooks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch notebooks:", err);
        setNotebooks([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchNotebooks();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${gatewayUrl}/notebooks`, { method: 'POST' });
      if (!res.ok) throw new Error("Create Failed");
      const nb = await res.json();
      onOpen(nb);
    } catch (e) {
      alert("创建失败: 请检查后端服务是否启动并配置正确");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("确定要彻底删除这个 Notebook 及其所有物理数据吗？")) return;
    try {
      await fetch(`${gatewayUrl}/notebooks/${id}`, { method: 'DELETE' });
      fetchNotebooks();
    } catch (e) {
      alert("删除失败");
    }
  };

  const renderIcon = (name: string) => {
    try {
      const IconComponent = (Icons as any)[name];
      if (typeof IconComponent !== 'function') return <Database size={24} />;
      return <IconComponent size={24} />;
    } catch (e) {
      return <Database size={24} />;
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white gap-6">
      <Loader2 className="animate-spin text-blue-600" size={64} />
      <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Accessing Insight Vault...</h1>
    </div>
  );

  return (
    <div className="h-screen bg-gray-50/50 p-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20"><Boxes className="text-white" size={28} /></div>
             <div>
               <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none">SeekInsight</h1>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Personal Knowledge Graph</p>
             </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black flex items-center gap-3 hover:bg-blue-700 transition-all shadow-2xl shadow-blue-500/20 active:scale-95 disabled:opacity-50"
          >
            {creating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            NEW NOTEBOOK
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {notebooks.length === 0 && !creating && (
             <div className="col-span-full py-32 text-center space-y-4 border-2 border-dashed border-gray-200 rounded-[3rem]">
                <div className="w-20 h-20 bg-blue-50 text-blue-300 rounded-3xl flex items-center justify-center mx-auto"><Sparkles size={40} /></div>
                <h3 className="text-xl font-bold text-gray-400">Empty Vault. Start your first research project.</h3>
             </div>
           )}
           {notebooks.map(nb => (
             <div
               key={nb.id}
               onClick={() => onOpen(nb)}
               className="group bg-white border border-gray-100 rounded-[2.5rem] p-8 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer relative overflow-hidden"
             >
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      {renderIcon(nb.icon_name)}
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, nb.id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">{nb.topic}</h3>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-auto pt-6">
                    <Calendar size={12} />
                    {new Date(nb.created_at).toLocaleDateString()}
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">ID: {nb.id.toUpperCase()}</span>
                    <ArrowRight size={20} className="text-gray-200 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
             </div>
           ))}
        </div>

        <div className="flex justify-center pt-16 pb-6 opacity-60 hover:opacity-100 transition-opacity duration-300">
           <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] flex items-center gap-3 cursor-default select-none hover:text-blue-400 transition-colors">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse"></div>
              powered by seekdb
           </span>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentNotebook, setCurrentNotebook] = useState<Notebook | null>(null);
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [hasNewSuggestions, setHasNewSuggestions] = useState(false);
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [tempTopic, setTempTopic] = useState("");

  const sqlReqId = useRef(0);
  const pythonReqId = useRef(0);
  const gatewayUrl = (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';

  const [project, setProject] = useState<ProjectState>({
    id: null,
    dbName: null,
    name: "Enterprise Data Hub",
    topicName: "未命名主题",
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
    isSqlAiFixing: false,
    isPythonAiGenerating: false,
    isPythonAiFixing: false,
    analysisReport: '',
    visualConfig: { chartType: 'bar' }
  } as ProjectState);

  useEffect(() => {
    const engine = new MySQLEngine();
    setDatabaseEngine(engine);

    const params = new URLSearchParams(window.location.search);
    const nbId = params.get('nb');
    if (nbId) {
      fetch(`${gatewayUrl}/notebooks`)
        .then(res => res.json())
        .then(notebooks => {
          if (Array.isArray(notebooks)) {
            const found = notebooks.find((n: Notebook) => n.id === nbId);
            if (found) handleOpenNotebook(found);
          }
        })
        .catch(err => console.error("Auto-open failed:", err));
    }
  }, []);

  useEffect(() => {
    if (dbReady && project.tables.length > 0 && project.suggestions.length === 0 && !isSuggesting) {
      handleFetchSuggestions();
    }
  }, [dbReady, project.tables.length, project.suggestions.length]);

  const handleOpenNotebook = async (nb: Notebook) => {
    setCurrentNotebook(nb);
    window.history.pushState({}, '', `?nb=${nb.id}`);

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
      tables,
      suggestions: initialSuggestions
    }));
    setDbReady(true);
  };

  const handleExit = () => {
    setCurrentNotebook(null);
    setDbReady(false);
    setHasNewSuggestions(false);
    window.history.pushState({}, '', '/');
  };

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
    if (!currentNotebook) return;
    const trimmed = newTopic.trim().substring(0, 30) || "未命名主题";
    setProject(prev => ({ ...prev, topicName: trimmed }));
    setIsEditingTopic(false);

    await fetch(`${gatewayUrl}/notebooks/${currentNotebook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: trimmed })
    });
  };

  const handleSqlAiGenerate = async (promptOverride?: string) => {
    const promptToUse = promptOverride || project.sqlAiPrompt;
    if (!promptToUse) return;
    setProject(prev => ({ ...prev, isSqlAiGenerating: true, lastSqlCodeBeforeAi: prev.sqlCode }));
    try {
      const code = await ai.generateCode(promptToUse, DevMode.SQL, project.tables);
      setProject(prev => ({ ...prev, sqlCode: code, isSqlAiGenerating: false }));
    } catch (err) {
      setProject(prev => ({ ...prev, isSqlAiGenerating: false }));
    }
  };

  const handlePythonAiGenerate = async (promptOverride?: string) => {
    const promptToUse = promptOverride || project.pythonAiPrompt;
    if (!promptToUse) return;
    setProject(prev => ({ ...prev, isPythonAiGenerating: true, lastPythonCodeBeforeAi: prev.pythonCode }));
    try {
      const code = await ai.generateCode(promptToUse, DevMode.PYTHON, project.tables);
      setProject(prev => ({ ...prev, pythonCode: code, isPythonAiGenerating: false }));
    } catch (err) {
      setProject(prev => ({ ...prev, isPythonAiGenerating: false }));
    }
  };

  const handleDebugSql = async () => {
    if (!project.lastSqlResult?.isError || !project.sqlCode) return;
    setProject(prev => ({ ...prev, isSqlAiFixing: true }));
    try {
      const logs = project.lastSqlResult.logs?.join('\n') || '';
      const fixed = await ai.debugCode(project.sqlAiPrompt, DevMode.SQL, project.tables, project.sqlCode, logs);
      setProject(prev => ({ ...prev, sqlCode: fixed, isAiFixing: false, isSqlAiFixing: false }));
      handleRun(fixed);
    } catch (err) {
      setProject(prev => ({ ...prev, isSqlAiFixing: false }));
    }
  };

  const handleDebugPython = async () => {
    if (!project.lastPythonResult?.isError || !project.pythonCode) return;
    setProject(prev => ({ ...prev, isPythonAiFixing: true }));
    try {
      const logs = project.lastPythonResult.logs?.join('\n') || '';
      const fixed = await ai.debugCode(project.pythonAiPrompt, DevMode.PYTHON, project.tables, project.pythonCode, logs);
      setProject(prev => ({ ...prev, pythonCode: fixed, isAiFixing: false, isPythonAiFixing: false }));
      handleRun(fixed);
    } catch (err) {
      setProject(prev => ({ ...prev, isPythonAiFixing: false }));
    }
  };

  const handleRun = async (codeOverride?: string) => {
    if (!dbReady || !currentNotebook) return;
    const currentMode = project.activeMode;
    const currentCode = codeOverride || (currentMode === DevMode.SQL ? project.sqlCode : project.pythonCode);
    setProject(prev => ({ ...prev, isExecuting: true }));
    try {
      let result: ExecutionResult;
      if (currentMode === DevMode.SQL) {
        result = await getDatabaseEngine().executeQuery(currentCode, currentNotebook.db_name);
      } else {
        const response = await fetch(`${gatewayUrl}/python`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: currentCode, dbName: currentNotebook.db_name })
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

  const handleUpload = async (file: File) => {
    if (!dbReady || !currentNotebook || isUploading) return;
    setIsUploading(true);
    setUploadProgress(null);

    const isTxt = file.name.toLowerCase().endsWith('.txt');
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        let finalHeaders: string[] = [];
        let finalObjects: any[] = [];
        const tableName = file.name
          .split('.')[0]
          .trim()
          .replace(/[^\p{L}\p{N}_]/gu, '_');

        if (isTxt) {
          // Robust encoding detection waterfall for .txt files
          const buffer = e.target?.result as ArrayBuffer;
          let textContent = "";
          
          try {
            // 1. Try UTF-8 (Strict)
            const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
            textContent = utf8Decoder.decode(buffer);
          } catch (e) {
            // 2. Fallback to GB18030 (Superset of GBK, covers almost all Chinese files)
            console.warn("UTF-8 decoding failed, falling back to GB18030/GBK");
            const gbkDecoder = new TextDecoder('gb18030');
            textContent = gbkDecoder.decode(buffer);
          }

          const paragraphs = textContent.split(/\n\s*\n/).map(p => p.trim()).filter(p => p);
          
          finalHeaders = ["paragraph_id", "content"];
          finalObjects = paragraphs.map((text, index) => ({
            "paragraph_id": index + 1,
            "content": text
          }));
        } else {
          // Parse Excel/CSV
          const rawFileData = e.target?.result as string;
          const workbook = XLSX.read(rawFileData, { 
            type: 'binary', 
            cellDates: true,
            dateNF: 'yyyy-mm-dd'
          });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawArrayData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          if (rawArrayData.length === 0) throw new Error("File is empty");

          const sampleRows = rawArrayData.slice(0, 5);
          let suspiciousNoHeader = true;

          if (rawArrayData.length > 1) {
            for (let col = 0; col < rawArrayData[0].length; col++) {
              const type0 = typeof rawArrayData[0][col];
              const type1 = typeof rawArrayData[1][col];
              if (type0 !== type1 && type0 !== 'undefined' && type1 !== 'undefined') {
                suspiciousNoHeader = false;
                break;
              }
            }
          }

          if (suspiciousNoHeader && rawArrayData.length > 0) {
            const aiResult = await ai.analyzeHeaders(sampleRows);
            if (aiResult.hasHeader) {
              finalHeaders = rawArrayData[0].map(h => String(h || `col_${Math.random().toString(36).substr(2, 4)}`));
              finalObjects = rawArrayData.slice(1).map(row => {
                const obj: any = {};
                finalHeaders.forEach((h, i) => obj[h] = row[i]);
                return obj;
              });
            } else {
              finalHeaders = aiResult.headers;
              finalObjects = rawArrayData.map(row => {
                const obj: any = {};
                finalHeaders.forEach((h, i) => obj[h] = row[i]);
                return obj;
              });
            }
          } else {
            finalHeaders = rawArrayData[0].map(h => String(h || `col_${Math.random().toString(36).substr(2, 4)}`));
            finalObjects = rawArrayData.slice(1).map(row => {
              const obj: any = {};
              finalHeaders.forEach((h, i) => obj[h] = row[i]);
              return obj;
            });
          }
        }

        let aiComments: Record<string, string> = {};
        try {
          aiComments = await ai.inferColumnMetadata(tableName, finalObjects);
        } catch (inferErr) {
          console.warn("AI Metadata Inference failed", inferErr);
        }

        const db = getDatabaseEngine();
        const newTable = await db.createTableFromData(
          tableName, 
          finalObjects, 
          currentNotebook.db_name, 
          aiComments,
          (percent) => {
            if (finalObjects.length > 500) setUploadProgress(percent);
          }
        );

        const updatedTables = [...project.tables.filter(t => t.tableName !== newTable.tableName), newTable];
        setProject(prev => ({ ...prev, tables: updatedTables }));

        try {
          const newTopic = await ai.generateTopic(project.topicName, updatedTables);
          if (newTopic && newTopic !== project.topicName) {
            handleUpdateTopic(newTopic);
          }
        } catch (aiErr) {
          console.warn("Topic auto-update failed:", aiErr);
        }

      } catch (err: any) {
        alert("Upload Error: " + err.message);
      } finally { 
        setIsUploading(false); 
        setUploadProgress(null);
      }
    };

    if (isTxt) {
      // Use ArrayBuffer for encoding detection
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const handleFetchSuggestions = async () => {
    if (isSuggesting || project.tables.length === 0) return;
    setIsSuggesting(true);
    try {
      const newSuggestions = await ai.generateSuggestions(project.tables, project.topicName, project.suggestions);
      const updatedSuggestions = [...project.suggestions, ...newSuggestions];
      setProject(prev => ({ ...prev, suggestions: updatedSuggestions }));
      
      if (project.activeMode !== DevMode.INSIGHT_HUB) {
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

  if (!currentNotebook) return <Lobby onOpen={handleOpenNotebook} />;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 z-20 shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform" onClick={handleExit}>
              <Boxes className="text-white" size={20} />
            </div>
            <div><h1 className="font-black text-gray-900 text-lg uppercase tracking-tighter leading-none">SeekInsight</h1></div>
          </div>
          <div className="h-6 w-px bg-gray-100"></div>

          <div className="flex items-center gap-2 group">
            {isEditingTopic ? (
              <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-blue-200">
                <input
                  autoFocus
                  value={tempTopic}
                  onChange={e => setTempTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUpdateTopic(tempTopic)}
                  className="bg-transparent border-none outline-none text-sm font-bold text-gray-800 px-2 w-48"
                />
                <button onClick={() => handleUpdateTopic(tempTopic)} className="p-1 hover:bg-blue-600 hover:text-white rounded text-blue-600 transition-colors"><Check size={14}/></button>
                <button onClick={() => setIsEditingTopic(false)} className="p-1 hover:bg-gray-200 rounded text-gray-400 transition-colors"><X size={14}/></button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 px-4 py-2 bg-gray-50/50 hover:bg-gray-100/80 rounded-xl cursor-pointer transition-all border border-transparent hover:border-gray-200"
                onClick={() => { setTempTopic(project.topicName); setIsEditingTopic(true); }}
              >
                <span className="text-sm font-black text-gray-700 tracking-tight">{project.topicName}</span>
                <PencilLine size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMarketOpen(true)} className="flex items-center gap-2 px-5 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold"><LayoutGrid size={16} /> Market</button>
          <button onClick={handleExit} className="w-9 h-9 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <DataSidebar
          tables={project.tables}
          onUploadFile={handleUpload}
          onRefreshTableStats={async t => {
            try {
              const count = await getDatabaseEngine().refreshTableStats(t, currentNotebook.db_name);
              setProject(prev => ({
                ...prev,
                tables: prev.tables.map(table =>
                  table.tableName === t ? { ...table, rowCount: count } : table
                )
              }));
            } catch (e: any) {
               // Handle deletion: if error indicates table is missing, remove it from UI
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
        />
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="px-8 pt-4 flex items-center gap-10 border-b border-gray-50">
            {[ 
              { id: DevMode.INSIGHT_HUB, label: 'Insight Hub' }, 
              { id: DevMode.SQL, label: 'SQL Editor' }, 
              { id: DevMode.PYTHON, label: 'Python Scripting' } 
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => {
                  setProject(p => ({ ...p, activeMode: tab.id as DevMode }));
                  if (tab.id === DevMode.INSIGHT_HUB) setHasNewSuggestions(false); 
                }} 
                className={`pb-4 text-sm font-black relative ${project.activeMode === tab.id ? 'text-blue-600' : 'text-gray-400'}`}
              >
                {tab.label}
                {tab.id === DevMode.INSIGHT_HUB && hasNewSuggestions && (
                  <div className="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                )}
                {project.activeMode === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"></div>}
              </button>
            ))}
          </div>
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
                onRun={() => handleRun()}
                isExecuting={project.isExecuting}
                isAiGenerating={project.isSqlAiGenerating}
                isAiFixing={project.isSqlAiFixing}
                onTriggerAi={() => handleSqlAiGenerate()}
                onDebug={handleDebugSql}
                tables={project.tables}
                onUndo={() => setProject(p => ({ ...p, sqlCode: p.lastSqlCodeBeforeAi || INITIAL_SQL }))}
                showUndo={!!project.lastSqlCodeBeforeAi}
              />
             )}
             {project.activeMode === DevMode.PYTHON && (
              <PythonWorkspace
                code={project.pythonCode}
                onCodeChange={v => setProject(p => ({ ...p, pythonCode: v }))}
                prompt={project.pythonAiPrompt}
                onPromptChange={v => setProject(p => ({ ...p, pythonAiPrompt: v }))}
                result={project.lastPythonResult}
                onRun={() => handleRun()}
                isExecuting={project.isExecuting}
                isAiGenerating={project.isPythonAiGenerating}
                isAiFixing={project.isPythonAiFixing}
                onTriggerAi={() => handlePythonAiGenerate()}
                onDebug={handleDebugPython}
                tables={project.tables}
                onUndo={() => setProject(p => ({ ...p, pythonCode: p.lastPythonCodeBeforeAi || INITIAL_PYTHON }))}
                showUndo={!!project.lastPythonCodeBeforeAi}
              />
             )}
          </div>
        </main>
        {project.activeMode === DevMode.SQL && <SqlPublishPanel result={project.lastSqlResult} analysis={project.analysisReport} isAnalyzing={project.isAnalyzing} isRecommendingCharts={project.isRecommendingCharts} onDeploy={async () => {}} isDeploying={false} />}
        {project.activeMode === DevMode.PYTHON && <PythonPublishPanel result={project.lastPythonResult} onDeploy={async () => {}} isDeploying={false} />}
      </div>
      {isMarketOpen && <AppMarket onClose={() => setIsMarketOpen(false)} />}
    </div>
  );
};

export default App;
