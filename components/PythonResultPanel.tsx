
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExecutionResult } from '../types';
import { Terminal as TerminalIcon, BarChart, Clock, Play, Box, Sparkles, RefreshCw } from 'lucide-react';
import Plot from 'react-plotly.js';

interface Props {
  result: ExecutionResult | null;
  isLoading: boolean;
  onDebug?: () => void;
  isAiLoading?: boolean;
  fullHeight?: boolean;
}

const MIN_HEIGHT = 240;

const PythonResultPanel: React.FC<Props> = ({ result, isLoading, onDebug, isAiLoading, fullHeight = false }) => {
  const [activeTab, setActiveTab] = useState<'console' | 'plot'>('console');
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);

  const hasError = result?.isError || (result?.logs && result.logs.some(l => l.toLowerCase().includes('error') || l.toLowerCase().includes('traceback')));

  const startResize = useCallback((e: React.MouseEvent) => {
    if (fullHeight) return;
    setIsResizing(true);
    startY.current = e.pageY;
    startHeight.current = height;
    document.body.style.cursor = 'ns-resize';
  }, [height, fullHeight]);

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

  // Handle automatic tab switching for Python results
  useEffect(() => {
    if (result) {
      if (hasError) {
        setActiveTab('console'); // Error is shown in console
      } else if (result.plotlyData) {
        setActiveTab('plot'); // Success with visual -> show visual
      } else {
        setActiveTab('console'); // Success without visual -> show console
      }
    }
  }, [result, hasError]);

  const containerStyle = fullHeight ? { height: '100%', flex: 1 } : { height };

  if (isLoading) return (
    <div style={containerStyle} className="border-t border-gray-200 bg-white flex flex-col items-center justify-center text-purple-600 animate-pulse">
      <Box size={24} className="animate-spin mb-3" />
      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Executing Python Runtime...</p>
    </div>
  );

  if (!result) return (
    <div style={containerStyle} className="border-t border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-300">
      <TerminalIcon size={24} className="opacity-10 mb-2" />
      <p className="text-xs font-black uppercase tracking-widest">Ready for Scripting</p>
    </div>
  );

  return (
    <div style={containerStyle} className="border-t border-gray-200 bg-white flex flex-col overflow-hidden relative group/resizer">
      {!fullHeight && (
        <div onMouseDown={startResize} className="absolute top-0 left-0 w-full h-1 cursor-ns-resize hover:bg-purple-500 z-50 flex items-center justify-center">
          <div className="w-8 h-1 bg-gray-200 rounded-full group-hover/resizer:bg-purple-400"></div>
        </div>
      )}

      <div className={`px-4 py-2 border-b border-gray-100 flex items-center justify-between shrink-0 ${hasError ? 'bg-red-50/50' : 'bg-gray-50'}`}>
        <div className="flex gap-1">
          <button onClick={() => setActiveTab('console')} className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'console' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            <TerminalIcon size={12} className="inline mr-1.5" /> {hasError ? 'Error Console' : 'Stdout/Stderr'}
          </button>
          {result.plotlyData && (
            <button onClick={() => setActiveTab('plot')} className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'plot' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
              <BarChart size={12} className="inline mr-1.5" /> Interactive Plot
            </button>
          )}
        </div>
        <div className="text-[10px] font-mono text-gray-400 uppercase font-bold tracking-wider">PY3.10 • {result.timestamp}</div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-white">
        <div className="absolute inset-0 overflow-auto">
          {activeTab === 'console' || !result.plotlyData ? (
            <div className={`p-4 font-mono text-[13px] leading-relaxed min-h-full ${hasError ? 'bg-red-50/5 text-red-700' : 'text-gray-700'}`}>
              {result.logs?.map((log, idx) => (
                <div key={idx} className="flex gap-3 py-0.5">
                  <span className="text-gray-300 select-none font-bold">[{idx+1}]</span>
                  <span className={log.toLowerCase().includes('error') || log.toLowerCase().includes('traceback') ? 'text-red-500 font-bold' : ''}>{log}</span>
                </div>
              ))}
              {result.logs?.length === 0 && <span className="text-gray-400 italic font-medium">Script completed with no stdout output.</span>}
            </div>
          ) : (
            <div className="h-full bg-white p-4">
              <Plot
                data={result.plotlyData?.data || []}
                layout={{
                  ...result.plotlyData?.layout,
                  autosize: true,
                  margin: { t: 30, r: 30, b: 30, l: 30 },
                  font: { family: 'Inter', size: 10 }
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ responsive: true, displaylogo: false }}
              />
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
