
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExecutionResult } from '../types';
import { Table as TableIcon, Clock, Hash, Play, Download, Terminal as TerminalIcon, Sparkles } from 'lucide-react';

interface Props {
  result: ExecutionResult | null;
  isLoading: boolean;
  onDebug?: () => void;
  isAiLoading?: boolean;
}

const MIN_HEIGHT = 240;

const SqlResultPanel: React.FC<Props> = ({ result, isLoading, onDebug, isAiLoading }) => {
  const [activeTab, setActiveTab] = useState<'table' | 'logs'>('table');
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);

  const hasError = result?.isError || (result?.logs && result.logs.some(l => l.toLowerCase().includes('error')));

  const startResize = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    startY.current = e.pageY;
    startHeight.current = height;
    document.body.style.cursor = 'ns-resize';
  }, [height]);

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

  useEffect(() => {
    if (hasError) setActiveTab('logs');
  }, [hasError]);

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

  if (isLoading) return (
    <div style={{ height }} className="border-t border-gray-200 bg-white flex flex-col items-center justify-center animate-pulse">
      <Clock size={20} className="text-gray-300 mb-2" />
      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Executing Query...</p>
    </div>
  );

  if (!result) return (
    <div style={{ height }} className="border-t border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-300">
      <Play size={24} className="opacity-10 mb-2" />
      <p className="text-xs font-black uppercase tracking-widest">Awaiting SQL Execution</p>
    </div>
  );

  return (
    <div style={{ height }} className="border-t border-gray-200 bg-white flex flex-col overflow-hidden relative group/resizer">
      <div onMouseDown={startResize} className="absolute top-0 left-0 w-full h-1 cursor-ns-resize hover:bg-blue-500 z-50 flex items-center justify-center">
        <div className="w-8 h-1 bg-gray-200 rounded-full group-hover/resizer:bg-blue-400"></div>
      </div>

      <div className={`px-4 py-2 border-b border-gray-100 flex items-center justify-between shrink-0 ${hasError ? 'bg-red-50/50' : 'bg-gray-50'}`}>
        <div className="flex gap-1">
          <button onClick={() => setActiveTab('table')} className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'table' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            <TableIcon size={12} className="inline mr-1" /> Data Table
          </button>
          <button onClick={() => setActiveTab('logs')} className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'logs' ? (hasError ? 'bg-red-600 text-white shadow-md' : 'bg-blue-600 text-white shadow-md') : 'text-gray-400 hover:text-gray-600'}`}>
            <TerminalIcon size={12} className="inline mr-1" /> {hasError ? 'Error Console' : 'SQL Logs'}
          </button>
        </div>
        <div className="flex items-center gap-4">
          {activeTab === 'table' && result.data.length > 0 && (
            <button onClick={exportToTSV} className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-1">
              <Download size={10} /> EXPORT TSV
            </button>
          )}
          <span className="text-[10px] font-mono text-gray-400 font-bold">{result.timestamp}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative">
        {activeTab === 'table' ? (
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
              {result.data.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/50">
                  {result.columns.map(col => (
                    <td key={col} className="px-3 py-1.5 text-gray-600 truncate max-w-xs">{String(row[col] ?? 'NULL')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={`p-4 font-mono text-xs whitespace-pre-wrap h-full ${hasError ? 'text-red-600 bg-red-50/10' : 'text-gray-500'}`}>
            {result.logs?.join('\n') || 'No logs generated.'}
          </div>
        )}

        {hasError && onDebug && (
          <div className="absolute bottom-6 right-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button 
              onClick={onDebug}
              disabled={isAiLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black shadow-2xl shadow-red-900/20 hover:bg-black transition-all active:scale-95 disabled:opacity-50"
            >
              <Sparkles size={14} className="text-blue-400 animate-pulse" />
              AUTO DEBUG WITH AI
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SqlResultPanel;
