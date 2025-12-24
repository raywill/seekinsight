
import React, { useState, useEffect } from 'react';
import { ExecutionResult, DevMode } from '../types';
import { Table as TableIcon, List, Clock, Hash, Play, Download, AlertCircle, BarChart, Terminal as TerminalIcon } from 'lucide-react';
import Plot from 'react-plotly.js';

interface Props {
  mode: DevMode;
  result: ExecutionResult | null;
  isLoading: boolean;
}

const ResultPanel: React.FC<Props> = ({ mode, result, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'table' | 'logs' | 'chart'>('table');

  useEffect(() => {
    if (result) {
      if (mode === DevMode.PYTHON) {
        if (result.plotlyData) {
          setActiveTab('chart');
        } else if (result.data.length > 0) {
          setActiveTab('table');
        } else {
          setActiveTab('logs');
        }
      } else {
        setActiveTab('table');
      }
    }
  }, [result, mode]);

  const exportToTSV = () => {
    if (!result || result.data.length === 0) return;

    const headers = result.columns.join('\t');
    const rows = result.data.map(row => 
      result.columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return str.replace(/\t/g, ' ').replace(/\n/g, ' ');
      }).join('\t')
    );

    const tsvContent = [headers, ...rows].join('\n');
    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `query_result_${new Date().getTime()}.tsv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="h-80 border-t border-gray-200 bg-white flex flex-col items-center justify-center gap-3 animate-pulse">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
          <Clock size={20} className="text-gray-300" />
        </div>
        <p className="text-sm text-gray-400 font-medium tracking-tight">Processing your request...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-80 border-t border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-400">
        <div className="p-3 border-2 border-dashed border-gray-200 rounded-xl mb-2">
           <Play size={24} className="opacity-20" />
        </div>
        <p className="text-sm font-medium">Run code to see results</p>
      </div>
    );
  }

  const hasError = result.logs && result.logs.length > 0 && result.data.length === 0 && !result.plotlyData;
  const isPython = mode === DevMode.PYTHON;

  return (
    <div className="h-96 border-t border-gray-200 bg-white flex flex-col overflow-hidden">
      {/* Dynamic Header with Tabs */}
      <div className={`px-4 py-1 border-b border-gray-100 flex items-center justify-between shrink-0 ${hasError ? 'bg-red-50/50' : 'bg-gray-50/50'}`}>
        <div className="flex items-center gap-2">
          {isPython ? (
            <div className="flex gap-1">
               {result.plotlyData && (
                 <button 
                  onClick={() => setActiveTab('chart')}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'chart' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                   <BarChart size={12} /> Chart
                 </button>
               )}
               {result.data.length > 0 && (
                 <button 
                  onClick={() => setActiveTab('table')}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'table' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                   <TableIcon size={12} /> Table
                 </button>
               )}
               <button 
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 <TerminalIcon size={12} /> Console
               </button>
            </div>
          ) : (
            <div className={`flex items-center gap-2 text-[11px] font-bold ${hasError ? 'text-red-600' : 'text-gray-600'}`}>
              {hasError ? <AlertCircle size={12} /> : <TableIcon size={12} />}
              <span>{hasError ? 'EXECUTION ERROR' : `RESULT: ${result.data.length} ROWS`}</span>
            </div>
          )}

          {!hasError && result.data.length > 0 && activeTab === 'table' && (
            <button 
              onClick={exportToTSV}
              className="flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all ml-2"
            >
              <Download size={10} />
              TSV
            </button>
          )}
        </div>
        <div className={`text-[10px] font-mono ${hasError ? 'text-red-400' : 'text-gray-400'}`}>
          {result.timestamp}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white relative">
        {activeTab === 'table' && (
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full text-left text-[11px] border-collapse table-auto">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="border-b border-gray-200">
                  {result.columns.map(col => (
                    <th key={col} className="px-2 py-1.5 font-bold text-gray-500 bg-gray-50/80 border-r border-gray-100 last:border-r-0 min-w-[100px] max-w-[400px]">
                      <div className="flex items-center gap-1.5 uppercase tracking-tighter">
                        <Hash size={10} className="text-gray-300 shrink-0" />
                        <span className="truncate">{col}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono bg-white">
                {result.data.map((row, i) => (
                  <tr key={i} className="hover:bg-blue-50/40 transition-colors group">
                    {result.columns.map(col => (
                      <td 
                        key={col} 
                        className="px-2 py-1 text-gray-600 break-words whitespace-pre-wrap max-w-[400px] border-r border-gray-50 last:border-r-0 leading-tight align-top"
                      >
                        {row[col] === null || row[col] === undefined ? (
                          <span className="text-gray-300 italic opacity-50">NULL</span>
                        ) : typeof row[col] === 'object' ? (
                          <span className="text-blue-500/80">{JSON.stringify(row[col])}</span>
                        ) : (
                          row[col].toString()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className={`p-4 font-mono text-[12px] space-y-1 h-full ${hasError ? 'bg-red-50/10 text-red-700' : 'text-gray-700 bg-gray-50/30'}`}>
            {result.logs?.map((log, i) => (
              <div key={i} className="flex gap-4">
                <span className={`select-none ${hasError ? 'text-red-300' : 'text-gray-300'}`}>[{i+1}]</span>
                <span className="break-all">{log}</span>
              </div>
            ))}
            {!hasError && (
              <div className="pt-4 mt-4 border-t border-gray-100 opacity-60">
                 <span className="text-blue-600 font-bold tracking-widest uppercase text-[10px]">&gt;&gt;&gt; Process Completed Successfully</span>
              </div>
            )}
            {hasError && (
              <div className="pt-4 mt-4 border-t border-red-100">
                 <span className="text-red-600 font-bold tracking-tight uppercase flex items-center gap-2">
                   <AlertCircle size={14} /> Critical Error Encountered
                 </span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chart' && result.plotlyData && (
          <div className="w-full h-full flex items-center justify-center p-4">
            <Plot
              data={result.plotlyData.data}
              layout={{
                ...result.plotlyData.layout,
                autosize: true,
                margin: { t: 40, r: 20, b: 40, l: 60 },
                font: { family: 'Inter, sans-serif', size: 10 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
              }}
              useResizeHandler={true}
              style={{ width: '100%', height: '100%' }}
              config={{ responsive: true, displayModeBar: true, displaylogo: false }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultPanel;
