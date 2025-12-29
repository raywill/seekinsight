
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExecutionResult } from '../types';
import { Terminal as TerminalIcon, BarChart, Clock, Play, Box, Sparkles, RefreshCw, Maximize2, Minimize2, Eye, Info, Hash, ChevronUp, ChevronDown } from 'lucide-react';
import Plot from 'react-plotly.js';

interface Props {
  result: ExecutionResult | null;
  previewResult?: ExecutionResult | null; // New prop for preview
  isLoading: boolean;
  onDebug?: () => void;
  isAiLoading?: boolean;
  fullHeight?: boolean;
}

const MIN_HEIGHT = 240;

const PythonResultPanel: React.FC<Props> = ({ result, previewResult, isLoading, onDebug, isAiLoading, fullHeight = false }) => {
  const [activeTab, setActiveTab] = useState<'console' | 'plot' | 'preview'>('console');
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(!fullHeight); // Default collapsed unless full height mode
  
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);

  const hasError = result?.isError || (result?.logs && result.logs.some(l => l.toLowerCase().includes('error') || l.toLowerCase().includes('traceback')));

  // Auto-expand on loading, explicit run result, or preview result
  useEffect(() => {
    if (fullHeight) return;
    if (isLoading) {
        setIsCollapsed(false);
    } else if (result || previewResult) {
        setIsCollapsed(false);
    }
  }, [isLoading, result, previewResult, fullHeight]);

  const startResize = useCallback((e: React.MouseEvent) => {
    if (fullHeight || isFullscreen) return;
    setIsResizing(true);
    startY.current = e.pageY;
    startHeight.current = height;
    document.body.style.cursor = 'ns-resize';
  }, [height, fullHeight, isFullscreen]);

  const stopResize = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = 'default';
  }, []);

  const onResize = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const delta = startY.current - e.pageY;
    setHeight(Math.max(MIN_HEIGHT, startHeight.current + delta));
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', onResize);
      window.addEventListener('mouseup', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', onResize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing, onResize, stopResize]);

  // Handle automatic tab switching
  useEffect(() => {
    if (previewResult) {
        setActiveTab('preview');
        return;
    }
    if (result) {
      if (hasError) {
        setActiveTab('console');
      } else if (result.plotlyData) {
        setActiveTab('plot');
      } else {
        setActiveTab('console');
      }
    }
  }, [result, previewResult, hasError]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    // Trigger a window resize event to force Plotly to redraw/fit the new container size immediately
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  };

  if (isCollapsed && !fullHeight) {
    return (
        <div className="h-9 border-t border-gray-200 bg-white flex items-center justify-between px-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setIsCollapsed(false)}>
            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 text-xs font-bold ${hasError ? 'text-red-600' : 'text-purple-600'}`}>
                    {isLoading ? <RefreshCw size={14} className="animate-spin" /> : (hasError ? <Info size={14} /> : <TerminalIcon size={14} />)}
                    {isLoading ? 'Running Script...' : (
                        hasError ? 'Execution Failed' : (
                            result ? 'Script Completed' : (previewResult ? 'Preview Mode Active' : 'Ready to Execute')
                        )
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
               <span className="text-[10px] font-mono">{result?.timestamp || previewResult?.timestamp || ''}</span>
               <ChevronUp size={14} />
            </div>
        </div>
    )
  }

  // Dynamic Styles based on State
  const containerStyle: React.CSSProperties = isFullscreen 
    ? { position: 'fixed', inset: 0, zIndex: 200, width: '100vw', height: '100vh' }
    : (fullHeight ? { height: '100%', flex: 1, width: '100%' } : { height });

  const containerClasses = isFullscreen
    ? "bg-white flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
    : `${fullHeight ? '' : 'border-t border-gray-200'} bg-white flex flex-col overflow-hidden relative group/resizer`;

  return (
    <div style={containerStyle} className={containerClasses}>
      {/* Overlay Backdrop when fullscreen to focus attention (optional visual tweak) */}
      {isFullscreen && <div className="absolute inset-0 bg-white z-0" />}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center transition-opacity duration-300">
             <RefreshCw size={24} className="animate-spin text-purple-600 mb-3" />
             <p className="text-[10px] font-black uppercase tracking-widest text-purple-900">Executing Python Runtime...</p>
        </div>
      )}

      {!fullHeight && !isFullscreen && (
        <div onMouseDown={startResize} className="absolute top-0 left-0 w-full h-1 cursor-ns-resize hover:bg-purple-500 z-50 flex items-center justify-center">
          <div className="w-8 h-1 bg-gray-200 rounded-full group-hover/resizer:bg-purple-400"></div>
        </div>
      )}

      {/* Header */}
      <div className={`relative z-10 px-4 py-2 border-b border-gray-100 flex items-center justify-between shrink-0 ${hasError && !previewResult ? 'bg-red-50/50' : 'bg-gray-50'}`}>
        <div className="flex gap-1">
          <button onClick={() => setActiveTab('console')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'console' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            <TerminalIcon size={12} className="inline mr-1.5" /> {hasError ? 'Error Console' : 'Stdout/Stderr'}
          </button>
          
          {result?.plotlyData && (
            <button onClick={() => setActiveTab('plot')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'plot' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
              <BarChart size={12} className="inline mr-1.5" /> Interactive Plot
            </button>
          )}

          {previewResult && (
            <button onClick={() => setActiveTab('preview')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'preview' ? 'bg-amber-100 text-amber-700 shadow-sm border border-amber-200' : 'text-gray-400 hover:text-gray-600'}`}>
              <Eye size={12} /> Data Preview
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-mono text-gray-400 uppercase font-bold tracking-wider hidden sm:block">
            PY3.10 • {result?.timestamp || previewResult?.timestamp}
          </div>
          <button 
            onClick={toggleFullscreen}
            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Maximize Panel"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {!fullHeight && (
              <button 
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                title="Collapse"
              >
                <ChevronDown size={14} />
              </button>
          )}
        </div>
      </div>

      <div className="relative z-10 flex-1 relative overflow-hidden bg-white">
        
        {/* Empty State */}
         {!result && !previewResult && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-gray-300">
                <TerminalIcon size={24} className="opacity-10 mb-2" />
                <p className="text-xs font-black uppercase tracking-widest">Ready for Scripting</p>
            </div>
         )}

        {/* PREVIEW TAB CONTENT */}
        {activeTab === 'preview' && previewResult && (
            <div className="flex flex-col h-full bg-amber-50/10">
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-[10px] text-amber-700 font-medium shrink-0">
                    <Info size={12} />
                    <span>System Preview: Showing top 10 sample rows. This data was not generated by your script.</span>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="min-w-full text-left text-[11px] border-collapse font-mono">
                        <thead className="sticky top-0 bg-white shadow-sm z-10">
                            <tr className="border-b border-gray-200">
                            {previewResult.columns.map(col => (
                                <th key={col} className="px-3 py-2 font-black text-gray-500 uppercase tracking-tighter bg-gray-50/80">
                                <div className="flex items-center gap-1"><Hash size={10} />{col}</div>
                                </th>
                            ))}
                            </tr>
                        </thead>
                        <tbody>
                            {previewResult.data.map((row, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/50">
                                {previewResult.columns.map(col => (
                                <td key={col} className="px-3 py-1.5 text-gray-600 max-w-xs truncate hover:bg-blue-50/30 align-top" title={String(row[col] ?? 'NULL')}>
                                    {String(row[col] ?? 'NULL')}
                                </td>
                                ))}
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* CONSOLE TAB CONTENT */}
        {activeTab === 'console' && result && (
            <div className={`h-full overflow-auto p-4 font-mono text-[13px] leading-relaxed ${hasError ? 'bg-red-50/5 text-red-700' : 'text-gray-700'}`}>
              {result?.logs?.map((log, idx) => (
                <div key={idx} className="flex gap-3 py-0.5">
                  <span className="text-gray-300 select-none font-bold">[{idx+1}]</span>
                  <span className={log.toLowerCase().includes('error') || log.toLowerCase().includes('traceback') ? 'text-red-500 font-bold' : ''}>{log}</span>
                </div>
              ))}
              {result?.logs?.length === 0 && <span className="text-gray-400 italic font-medium">Script completed with no stdout output.</span>}
            </div>
        )}

        {/* PLOT TAB CONTENT */}
        {activeTab === 'plot' && result?.plotlyData && (
            <div className="h-full bg-white p-4">
              <Plot
                data={result.plotlyData?.data || []}
                layout={{
                  ...result.plotlyData?.layout,
                  width: undefined, // Force autosize
                  height: undefined, // Force autosize
                  autosize: true,
                  margin: isFullscreen ? { t: 50, r: 50, b: 50, l: 50 } : { t: 30, r: 30, b: 30, l: 30 },
                  font: { family: 'Inter', size: isFullscreen ? 12 : 10 }
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ responsive: true, displaylogo: false }}
              />
            </div>
        )}

        {hasError && onDebug && activeTab === 'console' && (
          <div className="absolute bottom-6 right-6 animate-in fade-in slide-in-from-bottom-4 duration-500 z-[60]">
            <button 
              onClick={onDebug}
              disabled={isAiLoading}
              className="flex items-center gap-3 px-6 py-3.5 bg-red-600 text-white rounded-2xl text-[11px] font-black shadow-[0_10px_40px_rgba(220,38,38,0.4)] hover:bg-red-700 hover:shadow-red-500/50 transition-all active:scale-95 disabled:opacity-80 group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              {isAiLoading ? (
                <RefreshCw size={16} className="animate-spin text-white" />
              ) : (
                <Sparkles size={16} className="text-white animate-pulse" />
              )}
              <span className="uppercase tracking-[0.1em]">
                {isAiLoading ? 'Python Repair in Progress...' : 'AI Magic Fix'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PythonResultPanel;
