
import React, { useState, useEffect } from 'react';
import { PublishedApp, DevMode, ExecutionResult } from '../types';
import { X, Play, Copy, RefreshCw, Database, Terminal, Settings2, BarChart3 } from 'lucide-react';
import SqlResultPanel from './SqlResultPanel';
import PythonResultPanel from './PythonResultPanel';

interface Props {
  app: PublishedApp;
  onClose: () => void;
  onLoadToWorkspace: (app: PublishedApp) => void;
}

const AppViewer: React.FC<Props> = ({ app, onClose, onLoadToWorkspace }) => {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [params, setParams] = useState(app.params_schema || '{}');
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (app.snapshot_json) {
      try {
        setResult(JSON.parse(app.snapshot_json));
      } catch (e) {
        console.error("Failed to parse snapshot", e);
      }
    }
  }, [app]);

  const handleRun = async () => {
    setIsRunning(true);
    const gatewayUrl = (typeof process as any !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';
    
    try {
      let codeToRun = app.code;
      if (app.type === DevMode.PYTHON) {
        // Inject params
        try {
            // Validate JSON
            JSON.parse(params); 
            // Prepend params
            codeToRun = `SI_PARAMS = ${params}\n\n${app.code}`;
        } catch(e) {
            alert("Invalid JSON Params");
            setIsRunning(false);
            return;
        }
      }

      const endpoint = app.type === DevMode.SQL ? '/sql' : '/python';
      const body: any = { dbName: app.source_db_name };
      if (app.type === DevMode.SQL) body.sql = codeToRun;
      else body.code = codeToRun;

      const res = await fetch(`${gatewayUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      const execResult: ExecutionResult = {
        data: data.rows || data.data || [],
        columns: data.columns || [],
        logs: data.logs,
        plotlyData: data.plotlyData,
        timestamp: new Date().toLocaleTimeString(),
        isError: !res.ok
      };
      
      setResult(execResult);
    } catch (e) {
      console.error(e);
      alert("Execution failed. The source database might be offline.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white z-10">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${app.type === DevMode.SQL ? 'bg-blue-600 shadow-blue-200' : 'bg-purple-600 shadow-purple-200'}`}>
               {app.type === DevMode.SQL ? <BarChart3 size={24} /> : <Terminal size={24} />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 leading-tight">{app.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                 <span className="text-xs font-bold text-gray-400">by {app.author}</span>
                 <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                 <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">{app.type} APP</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
                onClick={() => onLoadToWorkspace(app)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
             >
               <Copy size={16} /> Load into Workspace
             </button>
             <button onClick={onClose} className="p-2.5 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-colors">
               <X size={20} />
             </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar / Controls */}
          <div className="w-80 bg-gray-50 border-r border-gray-100 p-6 flex flex-col overflow-y-auto">
             <div className="mb-8">
               <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Description</h4>
               <p className="text-sm text-gray-600 leading-relaxed font-medium">{app.description || "No description provided."}</p>
             </div>

             {app.type === DevMode.PYTHON && (
               <div className="mb-8 flex-1">
                 <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                   <Settings2 size={14} /> Input Parameters
                 </h4>
                 <textarea 
                    value={params}
                    onChange={(e) => setParams(e.target.value)}
                    className="w-full h-48 bg-white border border-gray-200 rounded-xl p-3 font-mono text-xs text-gray-700 resize-none focus:ring-2 focus:ring-purple-500/20 outline-none"
                 />
               </div>
             )}

             <div className="mt-auto">
                <button 
                  onClick={handleRun}
                  disabled={isRunning}
                  className={`w-full py-4 rounded-xl text-white font-black shadow-xl transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 ${app.type === DevMode.SQL ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'}`}
                >
                  {isRunning ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} />}
                  Run App
                </button>
                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 uppercase">
                  <Database size={12} /> Source: {app.source_db_name}
                </div>
             </div>
          </div>

          {/* Result Area */}
          <div className="flex-1 bg-white flex flex-col relative">
             <div className="absolute inset-0 overflow-hidden">
               {app.type === DevMode.SQL ? (
                 <SqlResultPanel result={result} isLoading={isRunning} />
               ) : (
                 <PythonResultPanel result={result} isLoading={isRunning} />
               )}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AppViewer;
