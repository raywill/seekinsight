
import React, { useState, useEffect } from 'react';
import { PublishedApp, DevMode, ExecutionResult } from '../types';
import { X, Play, Copy, RefreshCw, Database, Terminal, Settings2 } from 'lucide-react';
import PythonResultPanel from './PythonResultPanel';

interface Props {
  app: PublishedApp;
  onClose: () => void;
  onLoadToWorkspace: (app: PublishedApp) => void;
}

const PythonAppViewer: React.FC<Props> = ({ app, onClose, onLoadToWorkspace }) => {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [params, setParams] = useState(app.params_schema || '{}');
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (app.snapshot_json) {
      try {
        const parsed = JSON.parse(app.snapshot_json);
        // Legacy vs Composite snapshot handling
        if (parsed.result) {
            setResult(parsed.result);
        } else {
            setResult(parsed);
        }
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
      // Inject params
      try {
          JSON.parse(params); 
          codeToRun = `SI_PARAMS = ${params}\n\n${app.code}`;
      } catch(e) {
          alert("Invalid JSON Params");
          setIsRunning(false);
          return;
      }

      const endpoint = '/python';
      const body = { dbName: app.source_db_name, code: codeToRun };

      const res = await fetch(`${gatewayUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      const execResult: ExecutionResult = {
        data: data.data || [],
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
    <div className="fixed inset-0 z-[150] bg-gray-100 flex items-center justify-center">
      <div className="bg-white w-full h-full flex flex-col animate-in fade-in duration-300">
        
        {/* Fullscreen Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white z-20 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg bg-purple-600 shadow-purple-200">
               <Terminal size={24} />
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
          <div className="w-80 bg-gray-50 border-r border-gray-100 p-6 flex flex-col overflow-y-auto shrink-0 z-10">
             <div className="mb-8">
               <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Description</h4>
               <p className="text-sm text-gray-600 leading-relaxed font-medium">{app.description || "No description provided."}</p>
             </div>

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

             <div className="mt-auto">
                <button 
                  onClick={handleRun}
                  disabled={isRunning}
                  className="w-full py-4 rounded-xl text-white font-black shadow-xl transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 shadow-purple-500/20"
                >
                  {isRunning ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} />}
                  Run App
                </button>
                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 uppercase">
                  <Database size={12} /> Source: {app.source_db_name}
                </div>
             </div>
          </div>

          {/* Main Visual Content (Full Height Result Panel) */}
          <div className="flex-1 bg-white flex flex-col relative overflow-hidden">
             {/* Using fullHeight prop to occupy all available space */}
             <PythonResultPanel 
                result={result} 
                isLoading={isRunning} 
                fullHeight={true} 
             />
          </div>
        </div>

      </div>
    </div>
  );
};

export default PythonAppViewer;
