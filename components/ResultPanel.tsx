
import React from 'react';
import { ExecutionResult, DevMode } from '../types';
import { Table as TableIcon, List, Clock, Hash, Play, Download } from 'lucide-react';

interface Props {
  mode: DevMode;
  result: ExecutionResult | null;
  isLoading: boolean;
}

const ResultPanel: React.FC<Props> = ({ mode, result, isLoading }) => {
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
      <div className="h-64 border-t border-gray-200 bg-white flex flex-col items-center justify-center gap-3 animate-pulse">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
          <Clock size={20} className="text-gray-300" />
        </div>
        <p className="text-sm text-gray-400 font-medium tracking-tight">Processing your request...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-64 border-t border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-400">
        <div className="p-3 border-2 border-dashed border-gray-200 rounded-xl mb-2">
           <Play size={24} className="opacity-20" />
        </div>
        <p className="text-sm font-medium">Run code to see results</p>
      </div>
    );
  }

  return (
    <div className="h-80 border-t border-gray-200 bg-white flex flex-col overflow-hidden">
      <div className="px-4 py-1.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
            {mode === DevMode.SQL ? <TableIcon size={12} /> : <List size={12} />}
            <span>{mode === DevMode.SQL ? `RESULT: ${result.data.length} ROWS` : 'OUTPUT LOGS'}</span>
          </div>
          {mode === DevMode.SQL && result.data.length > 0 && (
            <button 
              onClick={exportToTSV}
              className="flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all"
            >
              <Download size={10} />
              TSV
            </button>
          )}
        </div>
        <div className="text-[10px] text-gray-400 font-mono">
          {result.timestamp}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        {mode === DevMode.SQL ? (
          <div className="inline-block min-w-full align-middle">
            {/* 修改: 去掉 table-fixed 改为 table-auto 以支持自适应宽度，但限制最大宽度 */}
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
                        /* 修改: 移除 truncate，增加 break-words 和 whitespace-pre-wrap 支持长文本换行，并限制 max-w */
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
        ) : (
          <div className="p-4 font-mono text-[12px] text-gray-700 space-y-1">
            {result.logs?.map((log, i) => (
              <div key={i} className="flex gap-4">
                <span className="text-gray-300 select-none">[{i+1}]</span>
                <span className="break-all">{log}</span>
              </div>
            ))}
            <div className="pt-4 mt-4 border-t border-gray-100">
               <span className="text-blue-600 font-bold">&gt;&gt;&gt; Done</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultPanel;
