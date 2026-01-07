
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PublishedApp, ExecutionResult } from '../types';
import { Play, RefreshCw, Database, Terminal, Settings2, PencilLine, GitFork, LayoutGrid, MoreVertical, Sliders, ChevronDown, Home, Share2, Copy, Check, Link as LinkIcon, X, Loader2 } from 'lucide-react';
import PythonResultPanel from './PythonResultPanel';
import { createShareSnapshot, getShareSnapshot } from '../services/appService';
import { executePython } from '../services/pythonService';

interface Props {
  app: PublishedApp;
  onClose: () => void;
  onHome?: () => void;
  onEdit?: (app: PublishedApp) => void;
  onClone?: (app: PublishedApp) => void;
  onFork?: (app: PublishedApp) => void;
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

const SharePopover = ({ isOpen, onClose, url }: { isOpen: boolean; onClose: () => void; url: string }) => {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      // Auto-select text when opened
      setTimeout(() => {
        if (inputRef.current) inputRef.current.select();
      }, 100);
    }
  }, [isOpen]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback for non-secure contexts
        if (inputRef.current) {
            inputRef.current.select();
            document.execCommand('copy');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
      }
    } catch (err) {
      console.error('Failed to copy', err);
      // Ensure text is selected so user can manual copy
      if (inputRef.current) inputRef.current.select();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100]" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 w-[360px] bg-white rounded-2xl shadow-xl border border-gray-200 z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <h3 className="text-xs font-black text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Share2 size={14} className="text-purple-600" />
            Share Configuration
          </h3>
        </div>
        
        <div className="p-4">
          <div className="flex items-center gap-2 p-1.5 bg-white border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-300 transition-all shadow-sm">
            <div className="flex-1 overflow-hidden">
               <input 
                 ref={inputRef}
                 type="text"
                 readOnly
                 value={url}
                 onClick={(e) => e.currentTarget.select()}
                 className="w-full px-2 py-1.5 bg-transparent border-none text-xs font-mono text-gray-600 focus:outline-none focus:ring-0 truncate"
               />
            </div>
            <button 
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all flex items-center gap-1.5 shadow-sm shrink-0 ${copied ? 'bg-green-500' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Helper function to extract layout commands from logs
const extractLayoutCommands = (logs: string[] | undefined) => {
    if (!logs) return {};
    let configUpdate: any = {};
    logs.forEach(log => {
        const trimmed = log.trim();
        if (trimmed.startsWith('__SI_CMD__:')) {
            try {
                const cmd = JSON.parse(trimmed.substring('__SI_CMD__:'.length));
                if (cmd.action === 'layout') {
                    // Map Python payload keys (sidebar/header) to React State keys (showSidebar/showHeader)
                    // We check both just in case backend is updated or legacy.
                    const p = cmd.payload;
                    if (p.sidebar !== undefined) configUpdate.showSidebar = p.sidebar;
                    if (p.header !== undefined) configUpdate.showHeader = p.header;
                    
                    if (p.showSidebar !== undefined) configUpdate.showSidebar = p.showSidebar;
                    if (p.showHeader !== undefined) configUpdate.showHeader = p.showHeader;
                }
            } catch (e) {
                console.warn("Invalid SI Command", e);
            }
        }
    });
    return configUpdate;
};

const PythonAppViewer: React.FC<Props> = ({ app, onClose, onHome, onEdit, onClone, onFork }) => {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, any>>({});
  const [schema, setSchema] = useState<Record<string, any>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Layout Control State
  const [layoutConfig, setLayoutConfig] = useState({
    showSidebar: true,
    showHeader: true
  });
  
  // Share State
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  
  const userInteracted = useRef(false);

  // Initialize Schema, Default Values, and Hydrate from URL
  useEffect(() => {
    userInteracted.current = false; // Reset interaction flag on app load
    
    // Async function to handle hydration
    const initialize = async () => {
        let mergedValues: Record<string, any> = {};
        let parsedSchema: Record<string, any> = {};

        if (app.params_schema) {
            try {
                parsedSchema = JSON.parse(app.params_schema);
                setSchema(parsedSchema);
                
                // 1. Initialize values based on schema defaults
                for (const [key, config] of Object.entries(parsedSchema)) {
                    mergedValues[key] = (config as any).default;
                }
            } catch (e) {
                console.error("Failed to parse params schema", e);
            }
        }

        // 2. Hydrate from Backend Snapshot ('s' param)
        const searchParams = new URLSearchParams(window.location.search);
        const shareId = searchParams.get('s') || searchParams.get('share');
        
        if (shareId) {
            try {
                const snapshotParams = await getShareSnapshot(shareId);
                if (snapshotParams) {
                    // Verify keys exist in schema to prevent pollution
                    const validValues: Record<string, any> = {};
                    Object.keys(snapshotParams).forEach(k => {
                       if (parsedSchema[k]) {
                          validValues[k] = snapshotParams[k];
                       }
                    });
                    
                    if (Object.keys(validValues).length > 0) {
                        mergedValues = { ...mergedValues, ...validValues };
                        userInteracted.current = true; 
                    }
                }
            } catch (e) {
                console.warn("Failed to load share snapshot", e);
            }
        }

        setParamValues(mergedValues);
    };

    initialize();

    // Load static result snapshot if available
    if (app.snapshot_json) {
      try {
        const parsed = JSON.parse(app.snapshot_json);
        let loadedResult: ExecutionResult | null = null;
        
        if (parsed.result) {
            loadedResult = parsed.result;
        } else {
            loadedResult = parsed;
        }

        if (loadedResult) {
            // Scan logs in snapshot for layout commands
            const snapshotCommands = extractLayoutCommands(loadedResult.logs);
            if (Object.keys(snapshotCommands).length > 0) {
                setLayoutConfig(prev => ({ ...prev, ...snapshotCommands }));
            }
            setResult(loadedResult);
        }
      } catch (e) {
          console.error("Failed to load snapshot", e);
      }
    }
  }, [app]);

  const handleParamChange = (key: string, value: any) => {
    userInteracted.current = true;
    setParamValues(prev => ({ ...prev, [key]: value }));
  };

  const handleShareClick = async () => {
     if (isGeneratingLink) return;
     setIsGeneratingLink(true);
     try {
         // Create Snapshot on Backend
         const shareId = await createShareSnapshot(app.id, paramValues);
         
         // Construct Clean URL
         const url = new URL(window.location.href);
         url.searchParams.set('app', app.id);
         url.searchParams.set('s', shareId);
         
         // Remove legacy params if any
         url.searchParams.delete('p_state');
         url.searchParams.delete('share_params');
         
         setShareUrl(url.toString());
         setIsShareOpen(true);
         setIsMenuOpen(false);
     } catch (e) {
         alert("Failed to generate share link.");
         console.error(e);
     } finally {
         setIsGeneratingLink(false);
     }
  };

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    
    try {
      // Use shared executePython service
      const execResult = await executePython(
        app.code, 
        app.source_db_name, 
        paramValues, 
        'EXECUTION'
      );
      
      // Process SI Commands from logs
      // Note: We use the helper function to extract commands.
      // We do NOT remove the command from the logs object that we set in state,
      // because PythonResultPanel handles hiding it visually.
      
      const commands = extractLayoutCommands(execResult.logs);
      if (Object.keys(commands).length > 0) {
          setLayoutConfig(prev => ({ ...prev, ...commands }));
      }

      setResult(execResult);
    } catch (e) {
      console.error(e);
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

    // Skip auto-run if we have a cached snapshot and the user hasn't changed any parameters yet (or loaded from URL).
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

  // Global ESC handler to restore layout if everything is hidden
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!layoutConfig.showHeader || !layoutConfig.showSidebar) {
           setLayoutConfig({ showHeader: true, showSidebar: true });
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [layoutConfig]);

  return (
    <div className="fixed inset-0 z-[150] bg-gray-100 flex items-center justify-center">
      <div className="bg-white w-full h-full flex flex-col animate-in fade-in duration-300">
        
        {/* Fullscreen Header - Conditionally Rendered */}
        {layoutConfig.showHeader && (
            <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white z-20 shadow-sm shrink-0 transition-all duration-300">
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
            <div className="relative flex items-center gap-2">
                <button
                    onClick={handleShareClick}
                    disabled={isGeneratingLink}
                    className={`p-2 rounded-full transition-colors ${isShareOpen ? 'bg-purple-50 text-purple-600' : 'text-gray-400 hover:bg-gray-100'}`}
                    title="Share App State"
                >
                    {isGeneratingLink ? <Loader2 size={20} className="animate-spin text-purple-500" /> : <Share2 size={20} />}
                </button>

                {/* Share Popover positioned relative to the button group */}
                <SharePopover isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} url={shareUrl} />

                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className={`p-2 rounded-full transition-colors outline-none ${isMenuOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-900 hover:bg-gray-100'}`}
                >
                    <MoreVertical size={20} />
                </button>

                {/* Close Button - Only in Header */}
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors ml-2"><X size={24}/></button>

                {isMenuOpen && (
                <>
                    <div className="fixed inset-0 z-[40]" onClick={() => setIsMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl z-[50] overflow-hidden p-1.5 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                        <button 
                        onClick={handleShareClick}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 text-sm font-bold text-gray-700 transition-colors sm:hidden"
                        >
                        <LinkIcon size={16} className="text-purple-500" /> Share Link
                        </button>

                        {app.source_notebook_id && onEdit && (
                            <>
                                <button 
                                onClick={() => { onEdit(app); setIsMenuOpen(false); }}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 text-sm font-bold text-gray-700 transition-colors"
                                >
                                <PencilLine size={16} className="text-purple-500" /> Edit App
                                </button>
                            </>
                        )}

                        {onFork && (
                            <button 
                            onClick={() => { onFork(app); setIsMenuOpen(false); }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 text-sm font-bold text-gray-700 transition-colors"
                            >
                            <GitFork size={16} className="text-purple-500" /> Fork as New App
                            </button>
                        )}
                        
                        <button 
                        onClick={handleCloneClick}
                        disabled={isCloning}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 text-sm font-bold text-gray-700 transition-colors"
                        >
                        {isCloning ? <RefreshCw size={16} className="animate-spin text-gray-400" /> : <Terminal size={16} className="text-gray-400" />} 
                        Remix in Notebook
                        </button>

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
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar / Controls - Conditionally Rendered */}
          {layoutConfig.showSidebar && (
            <div className="w-80 bg-gray-50 border-r border-gray-100 p-6 flex flex-col overflow-y-auto shrink-0 z-10 transition-all duration-300">
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
          )}

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
