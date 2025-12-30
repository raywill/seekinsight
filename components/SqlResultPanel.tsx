
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExecutionResult } from '../types';
import { Table as TableIcon, List, Clock, Hash, Play, Download, AlertCircle, BarChart, Terminal as TerminalIcon, GripHorizontal, Maximize2, Minimize2, Eye, Info, ChevronUp, ChevronDown, RefreshCw, Sparkles } from 'lucide-react';

interface Props {
  result: ExecutionResult | null;
  previewResult?: ExecutionResult | null; // New prop for preview
  isLoading: boolean;
  onDebug?: () => void;
  isAiLoading?: boolean;
}

const MIN_HEIGHT = 240;

const SqlResultPanel: React.FC<Props> = ({ result, previewResult, isLoading, onDebug, isAiLoading }) => {
  const [activeTab, setActiveTab] = useState<'table' | 'logs' | 'preview'>('table');
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  
  const panelRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);

  const hasError = result?.isError || (result?.logs && result.logs.some(l => l.toLowerCase().includes('error')));

  // Auto-expand on loading, explicit run result, or preview result
  useEffect(() => {
    if (isLoading) {
        setIsCollapsed(false);
    } else if (result || previewResult) {
        setIsCollapsed(false);
    }
  }, [isLoading, result, previewResult]);

  // Handle Resize Events
  const startResize = useCallback((e: React.MouseEvent) => {
    if (isFullscreen) return;
    setIsResizing(true);
    startY.current = e.pageY;
    startHeight.current = height;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [height, isFullscreen]);

  const stopResize = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  const onResize = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const delta = startY.current - e.pageY;
    const newHeight = Math.max(MIN_HEIGHT, startHeight.current + delta);
    setHeight(newHeight);
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

  useEffect(() => {
    if (previewResult) {
        setActiveTab('preview');
        return;
    }
    if (result) {
      if (hasError) {
        setActiveTab('logs');
      } else if (result.data && result.data.length > 0) {
        setActiveTab('table');
      } else {
        setActiveTab('table');
      }
      setExpandedCells(new Set());
    }
  }, [result, previewResult, hasError]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          setExpandedCells(new Set());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleCellClick = (rowIndex: number, colKey: string) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    const key = `${rowIndex}-${colKey}`;
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const exportToTSV = () => {
    if (!result || result.data.length === 0) return;
    const headers = result.columns.join('\t');
    const rows = result.data.map(row => 
      result.columns.map(col => String(row[col] ?? '')).join('\t')
    );
    const tsvContent = [headers, ...rows].join('\n');
    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sql_result_${Date.now()}.tsv`;
    link.click();
  };

  if (isCollapsed) {
    return (
        <div className="h-9 border-t border-gray-200 bg-white flex items-center justify-between px-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setIsCollapsed(false)}>
            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 text-xs font-bold ${hasError ? 'text-red-600' : 'text-gray-500'}`}>
                    {isLoading ? <RefreshCw size={14} className="animate-spin text-blue-500" /> : (hasError ? <AlertCircle size={14} /> : <TerminalIcon size={14} />)}
                    {isLoading ? 'Executing SQL...' : (
                        hasError ? 'Execution Failed' : (
                            result ? `Success: ${result.data.length} rows returned` : (previewResult ? 'Preview Mode Active' : 'Ready to Execute')
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

  const containerStyle: React.CSSProperties = isFullscreen 
    ? { position: 'fixed', inset: 0, zIndex: 200, width: '100vw', height: '100vh' }
    : { height };

  const containerClasses = isFullscreen
    ? "bg-white flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
    : "border-t border-gray-200 bg-white flex flex-col overflow-hidden relative group/resizer";

  return (
    <div ref={panelRef} style={containerStyle} className={containerClasses}>
      {isFullscreen && <div className="absolute inset-0 bg-white z-0" />}
      
      {!isFullscreen && (
        <div onMouseDown={startResize} className="absolute top-0 left-0 w-full h-1 cursor-ns-resize hover:bg-blue-500/30 transition-colors z-50 flex items-center justify-center">
          <div className="w-8 h-1 bg-gray-200 rounded-full group-hover/resizer:bg-blue-400 transition-colors"></div>
        </div>
      )}

      {/* Header */}
      <div className={`relative z-10 px-4 py-2 border-b border-gray-100 flex items-center justify-between shrink-0 ${hasError && !previewResult ? 'bg-red-50/50' : 'bg-gray-50'}`}>
        <div className="flex gap-1">
          <button onClick={() => setActiveTab('table')} className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'table' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            <TableIcon size={12} className="inline mr-1" /> Data Table
          </button>
          <button onClick={() => setActiveTab('logs')} className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'logs' ? (hasError ? 'bg-red-600 text-white shadow-md' : 'bg-blue-600 text-white shadow-md') : 'text-gray-400 hover:text-gray-600'}`}>
            <TerminalIcon size={12} className="inline mr-1" /> {hasError ? 'Error Console' : 'SQL Logs'}
          </button>
          {previewResult && (
            <button onClick={() => setActiveTab('preview')} className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'preview' ? 'bg-amber-100 text-amber-700 shadow-sm border border-amber-200' : 'text-gray-400 hover:text-gray-600'}`}>
              <Eye size={12} /> Data Preview
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'table' && result?.data && result.data.length > 0 && (
            <button onClick={exportToTSV} className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-1 mr-2">
              <Download size={10} /> EXPORT TSV
            </button>
          )}
          <span className="text-[10px] font-mono text-gray-400 font-bold hidden sm:block">{result?.timestamp || previewResult?.timestamp}</span>
          
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Maximize Panel"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button 
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="Collapse"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className="relative z-10 flex-1 relative overflow-hidden bg-white">
         {/* Updated Minimal Capsule Loader (More Transparent) */}
         {isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                <div className="bg-white/60 border border-blue-100/50 shadow-lg shadow-blue-500/5 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-200">
                    <RefreshCw size={14} className="text-blue-600 animate-spin" />
                    <span className="text-[11px] font-black text-gray-700 uppercase tracking-wider">Executing Query...</span>
                </div>
            </div>
         )}
         
         {/* Empty State */}
         {!result && !previewResult && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-gray-300">
                <Play size={24} className="opacity-10 mb-2" />
                <p className="text-xs font-black uppercase tracking-widest">Awaiting SQL Execution</p>
            </div>
         )}

        <div className="absolute inset-0 overflow-auto flex flex-col">
          
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
                                {previewResult.columns.map(col => {
                                  const isExpanded = expandedCells.has(`${i}-${col}`);
                                  const cellValue = String(row[col] ?? 'NULL');
                                  return (
                                    <td 
                                      key={col} 
                                      className={`px-3 py-1.5 text-gray-600 max-w-xs border-r border-transparent transition-all align-top ${
                                        isExpanded 
                                          ? 'whitespace-pre-wrap break-words bg-blue-50/30 cursor-text' 
                                          : 'truncate hover:bg-blue-50/30'
                                      }`}
                                      onClick={() => handleCellClick(i, col)}
                                      title={!isExpanded ? cellValue : undefined}
                                    >
                                      {cellValue}
                                    </td>
                                  );
                                })}
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

          {/* TABLE TAB CONTENT */}
          {activeTab === 'table' && result && (
            <table className="min-w-full text-left text-[11px] border-collapse font-mono">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-200">
                  {result.columns.map(col => (
                    <th key={col} className="px-3 py-2 font-black text-gray-500 uppercase tracking-tighter">
                      <div className="flex items-center gap-1"><Hash size={10} />{col}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.length > 0 ? result.data.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/50">
                    {result.columns.map(col => {
                      const isExpanded = expandedCells.has(`${i}-${col}`);
                      const cellValue = String(row[col] ?? 'NULL');
                      return (
                        <td 
                          key={col} 
                          onClick={() => handleCellClick(i, col)}
                          title={!isExpanded ? cellValue : undefined}
                          className={`px-3 py-1.5 text-gray-600 max-w-xs border-r border-transparent transition-all align-top ${
                            isExpanded 
                              ? 'whitespace-pre-wrap break-words bg-blue-50/30 cursor-text' 
                              : 'truncate hover:bg-blue-50/30'
                          }`}
                        >
                          {cellValue}
                        </td>
                      );
                    })}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={result.columns.length || 1} className="p-8 text-center text-gray-400 font-bold uppercase tracking-widest italic">
                      No records returned
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* LOGS TAB CONTENT */}
          {activeTab === 'logs' && (
            <div className={`p-4 font-mono text-xs whitespace-pre-wrap min-h-full ${hasError ? 'text-red-700 bg-red-50/10' : 'text-gray-500'}`}>
              {hasError && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-red-100/50 border border-red-200 rounded-xl">
                  <AlertCircle size={16} className="text-red-600 shrink-0" />
                  <span className="font-black uppercase tracking-tight">Execution Failed</span>
                </div>
              )}
              {result?.logs?.join('\n') || 'No logs generated.'}
            </div>
          )}
        </div>

        {hasError && onDebug && (
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
                {isAiLoading ? 'AI Repairing Code...' : 'AI Magic Fix'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SqlResultPanel;
