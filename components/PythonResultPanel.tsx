
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExecutionResult } from '../types';
import { Terminal as TerminalIcon, BarChart, Clock, Play, Box } from 'lucide-react';
import Plot from 'react-plotly.js';

interface Props {
  result: ExecutionResult | null;
  isLoading: boolean;
}

const MIN_HEIGHT = 240;

const PythonResultPanel: React.FC<Props> = ({ result, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'console' | 'plot'>('console');
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);

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
    if (result?.plotlyData) setActiveTab('plot');
    else setActiveTab('console');
  }, [result]);

  if (isLoading) return (
    <div style={{ height }} className="border-t border-gray-200 bg-gray-900 flex flex-col items-center justify-center text-blue-400">
      <Box size={24} className="animate-spin mb-3" />
      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Executing Python Runtime...</p>
    </div>
  );

  if (!result) return (
    <div style={{ height }} className="border-t border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-300">
      <TerminalIcon size={24} className="opacity-10 mb-2" />
      <p className="text-xs font-black uppercase tracking-widest">Ready for Scripting</p>
    </div>
  );

  return (
    <div style={{ height }} className="border-t border-gray-200 bg-white flex flex-col overflow-hidden relative group/resizer">
      <div onMouseDown={startResize} className="absolute top-0 left-0 w-full h-1 cursor-ns-resize hover:bg-purple-500 z-50 flex items-center justify-center">
        <div className="w-8 h-1 bg-gray-200 rounded-full group-hover/resizer:bg-purple-400"></div>
      </div>

      <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex gap-1">
          <button onClick={() => setActiveTab('console')} className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'console' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <TerminalIcon size={12} className="inline mr-1.5" /> Stdout/Stderr
          </button>
          {result.plotlyData && (
            <button onClick={() => setActiveTab('plot')} className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'plot' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <BarChart size={12} className="inline mr-1.5" /> Interactive Plot
            </button>
          )}
        </div>
        <div className="text-[10px] font-mono text-gray-500">PY3.10 • {result.timestamp}</div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-950">
        {activeTab === 'console' ? (
          <div className="p-4 font-mono text-[13px] text-gray-300 leading-relaxed">
            {result.logs?.map((log, idx) => (
              <div key={idx} className="flex gap-3">
                <span className="text-gray-700 select-none">[{idx+1}]</span>
                <span className={log.toLowerCase().includes('error') ? 'text-red-400' : ''}>{log}</span>
              </div>
            ))}
            {result.logs?.length === 0 && <span className="text-gray-600 italic">Script completed with no output.</span>}
          </div>
        ) : (
          <div className="h-full bg-white p-4">
            <Plot
              data={result.plotlyData.data || []}
              layout={{
                ...result.plotlyData.layout,
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
    </div>
  );
};

export default PythonResultPanel;
