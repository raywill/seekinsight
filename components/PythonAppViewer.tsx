
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PublishedApp, ExecutionResult } from '../types';
import { Play, RefreshCw, Database, Terminal, Settings2, PencilLine, GitFork, LayoutGrid, MoreVertical, Sliders, ChevronDown, Home } from 'lucide-react';
import PythonResultPanel from './PythonResultPanel';

interface Props {
  app: PublishedApp;
  onClose: () => void;
  onHome?: () => void;
  onEdit?: (app: PublishedApp) => void;
  onClone?: (app: PublishedApp) => void;
}

// UI Components for Dynamic Form
const RangeInput = ({ label, value, min, max, step, onChange }: any) => (
  <div className="space-y-2 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
    <div className="flex justify-between items-center">
      <label className="text-[11px] font-black text-gray-700 uppercase tracking-wide">{label}</label>
      <span className="text-xs font-mono font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{value}</span>
    </div>
    <input 
      type="range" 
      min={min} max={max} step={step} 
      value={value} 
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
    />
    <div className="flex justify-between text-[9px] text-gray-400 font-bold">
      <span>{min}</span>
      <span>{max}</span>
    </div>
  </div>
);

const SelectInput = ({ label, value, options, onChange }: any) => (
  <div className="space-y-1.5 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
    <label className="text-[11px] font-black text-gray-700 uppercase tracking-wide">{label}</label>
    <div className="relative">
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 appearance-none focus:ring-2 focus:ring-purple-500/20 outline-none"
      >
        {options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
    </div>
  </div>
);

const TextInput = ({ label, value, onChange }: any) => (
  <div className="space-y-1.5 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
    <label className="text-[11px] font-black text-gray-700 uppercase tracking-wide">{label}</label>
    <input 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:ring-2 focus:ring-purple-500/20 outline-none"
    />
  </div>
);

const PythonAppViewer: React.FC<Props> = ({ app, onClose, onHome, onEdit, onClone }) => {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, any>>({});
  const [schema, setSchema] = useState<Record<string, any>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const userInteracted = useRef(false);

  // Initialize Schema and Default Values
  useEffect(() => {
    userInteracted.current = false; // Reset interaction flag on app load
    
    if (app.params_schema) {
      try {
        const parsedSchema = JSON.parse(app.params_schema);
        setSchema(parsedSchema);
        
        // Initialize values based on schema defaults
        const initialValues: Record<string, any> = {};
        for (const [key, config] of Object.entries(parsedSchema)) {
          initialValues[key] = (config as any).default;
        }
        setParamValues(initialValues);
      } catch (e) {
        console.error("Failed to parse params schema", e);
      }
    }

    if (app.snapshot_json) {
      try {
        const parsed = JSON.parse(app.snapshot_json);
        if (parsed.result) {
            setResult(parsed.result);
        } else {
            setResult(parsed);
        }
      } catch (e) {}
    }
  }, [app]);

  const handleParamChange = (key: string, value: any) => {
    userInteracted.current = true;
    setParamValues(prev => ({ ...prev, [key]: value }));
  };

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    const gatewayUrl = (typeof process as any !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';
    
    try {
      const endpoint = '/python';
      // Pass executionMode 'EXECUTION' (default) and the collected params
      const body = { 
        dbName: app.source_db_name, 
        code: app.code,
        executionMode: 'EXECUTION',
        params: paramValues 
      };

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
      // alert("Execution failed. The source database might be offline.");
    } finally {
      setIsRunning(false);
    }
  }, [app.source_db_name, app.code, paramValues]);

  // Debounced Auto-Run Effect
  useEffect(() => {
    // Determine if we have values to run. 
    // If schema exists but paramValues is empty (initial load before state update), wait.
    const hasSchema = Object.keys(schema).length > 0;
    const hasValues = Object.keys(paramValues).length > 0;
    
    // Safety check: Don't run if we expect params but don't have them yet.
    if (hasSchema && !hasValues) return;

    // Skip auto-run if we have a cached snapshot and the user hasn't changed any parameters yet.
    if (app.snapshot_json && !userInteracted.current) return;

    const timer = setTimeout(() => {
      handleRun();
    }, 500);

    return () => clearTimeout(timer);
  }, [paramValues, handleRun, schema, app.snapshot_json]);

  const handleCloneClick = async () => {
    if (!onClone) return;
    setIsCloning(true);
    try {
        await onClone(app);
    } finally {
        setIsCloning(false);
        setIsMenuOpen(false);
    }
  }

  const hasSchema = Object.keys(schema).length > 0;

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
          <div className="relative">
             <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-900 outline-none"
             >
                <MoreVertical size={20} />
             </button>

             {isMenuOpen && (
               <>
                 <div className="fixed inset-0 z-[40]" onClick={() => setIsMenuOpen(false)} />
                 <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-[50] overflow-hidden p-1.5 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    {app.source_notebook_id && onEdit && (
                        <button 
                           onClick={() => { onEdit(app); setIsMenuOpen(false); }}
                           className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 text-sm font-bold text-gray-700 transition-colors"
                        >
                          <PencilLine size={16} className="text-gray-400" /> Edit
                        </button>
                    )}
                    
                    {onClone && (
                        <button 
                           onClick={handleCloneClick}
                           disabled={isCloning}
                           className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 text-sm font-bold text-gray-700 transition-colors"
                        >
                          {isCloning ? <RefreshCw size={16} className="animate-spin text-purple-500" /> : <GitFork size={16} className="text-gray-400" />} 
                          Clone
                        </button>
                    )}

                    <div className="h-px bg-gray-100 my-1"></div>

                    <button 
                       onClick={onClose} 
                       className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 text-sm font-bold text-gray-700 transition-colors"
                    >
                      <LayoutGrid size={16} className="text-gray-400" /> Marketplace
                    </button>

                    {onHome && (
                        <button 
                            onClick={onHome} 
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 text-sm font-bold text-gray-700 transition-colors"
                        >
                            <Home size={16} className="text-gray-400" /> Home
                        </button>
                    )}
                 </div>
               </>
             )}
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
                 <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <Settings2 size={14} /> Configuration
                 </h4>
                 
                 {hasSchema ? (
                   <div className="space-y-4">
                     {Object.entries(schema).map(([key, config]: [string, any]) => {
                       if (config.type === 'slider') {
                         return <RangeInput key={key} {...config} value={paramValues[key] ?? config.default} onChange={(v: any) => handleParamChange(key, v)} />;
                       }
                       if (config.type === 'select') {
                         return <SelectInput key={key} {...config} value={paramValues[key] ?? config.default} onChange={(v: any) => handleParamChange(key, v)} />;
                       }
                       return <TextInput key={key} {...config} value={paramValues[key] ?? config.default} onChange={(v: any) => handleParamChange(key, v)} />;
                     })}
                   </div>
                 ) : (
                    <div className="p-4 bg-white border border-dashed border-gray-200 rounded-xl text-center">
                       <Sliders size={20} className="text-gray-300 mx-auto mb-2" />
                       <p className="text-xs text-gray-400 font-medium">No interactive parameters defined.</p>
                    </div>
                 )}
             </div>

             <div className="mt-auto">
                <button 
                  onClick={handleRun}
                  disabled={isRunning}
                  className="w-full py-4 rounded-xl text-white font-black shadow-xl transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 shadow-purple-500/20"
                >
                  {isRunning ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} />}
                  Run Analysis
                </button>
                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 uppercase">
                  <Database size={12} /> Source: {app.source_db_name}
                </div>
             </div>
          </div>

          {/* Main Visual Content (Full Height Result Panel) */}
          <div className="flex-1 bg-white flex flex-col relative overflow-hidden h-full">
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
