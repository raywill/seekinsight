
import React from 'react';
import { ExecutionResult, DevMode } from '../types';
import { Table as TableIcon, List, Clock, Hash, Play } from 'lucide-react';

interface Props {
  mode: DevMode;
  result: ExecutionResult | null;
  isLoading: boolean;
}

const ResultPanel: React.FC<Props> = ({ mode, result, isLoading }) => {
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
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
          {mode === DevMode.SQL ? <TableIcon size={14} /> : <List size={14} />}
          <span>{mode === DevMode.SQL ? `Query Result (${result.data.length} rows)` : 'Output Logs'}</span>
        </div>
        <div className="text-[10px] text-gray-400 font-mono">
          Last updated: {result.timestamp}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50/20">
        {mode === DevMode.SQL ? (
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full text-left text-sm border-collapse table-auto">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="border-b border-gray-100">
                  {result.columns.map(col => (
                    <th key={col} className="px-4 py-3 font-semibold text-gray-500 bg-gray-50/80 min-w-[180px] max-w-md">
                      <div className="flex items-center gap-1.5 uppercase tracking-tighter text-[10px]">
                        <Hash size={10} className="flex-shrink-0" />
                        <span className="truncate">{col}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[12px] bg-white">
                {result.data.map((row, i) => (
                  <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                    {result.columns.map(col => (
                      <td 
                        key={col} 
                        className="px-4 py-4 text-gray-600 break-words whitespace-pre-wrap align-top leading-relaxed min-w-[180px] max-w-md border-r border-gray-50 last:border-r-0"
                      >
                        {row[col] === null || row[col] === undefined ? (
                          <span className="text-gray-300 italic">NULL</span>
                        ) : typeof row[col] === 'object' ? (
                          <span className="text-blue-500">{JSON.stringify(row[col])}</span>
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
          <div className="p-4 font-mono text-[13px] text-gray-700 space-y-1">
            {result.logs?.map((log, i) => (
              <div key={i} className="flex gap-4">
                <span className="text-gray-300 select-none">[{i+1}]</span>
                <span className="break-all">{log}</span>
              </div>
            ))}
            <div className="pt-4 mt-4 border-t border-gray-100">
               <span className="text-blue-600 font-bold">&gt;&gt;&gt; Process finished with exit code 0</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultPanel;
