
import React, { useState } from 'react';
import { TableMetadata } from '../types';
import { Database, Table, ChevronDown, ChevronRight, Upload, Info, Loader2, RefreshCw, FileSpreadsheet, ArrowRight, Cloud } from 'lucide-react';

interface Props {
  tables: TableMetadata[];
  onUploadFile: (file: File) => void;
  onRefreshTableStats: (tableName: string) => Promise<void>;
  isUploading: boolean;
}

const DataSidebar: React.FC<Props> = ({ tables, onUploadFile, onRefreshTableStats, isUploading }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});

  const toggleTable = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRefresh = async (e: React.MouseEvent, tableName: string) => {
    e.stopPropagation();
    if (refreshing[tableName]) return;

    setRefreshing(prev => ({ ...prev, [tableName]: true }));
    try {
      await onRefreshTableStats(tableName);
    } finally {
      setRefreshing(prev => ({ ...prev, [tableName]: false }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm">
      {/* Header - Upload button is replaced by loading state during sync */}
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
        <h2 className="text-sm font-black text-[#1e293b] flex items-center gap-2 uppercase tracking-tight">
          <Database size={18} className="text-[#2563eb]" />
          DATA SOURCES
        </h2>
        <div className="flex items-center justify-center min-w-[32px]">
          {isUploading ? (
            <div className="flex items-center gap-1.5 text-blue-500 animate-pulse">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : (
            <label className="cursor-pointer p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600" title="Import data into Database">
              <Upload size={20} />
              <input type="file" className="hidden" onChange={handleFileChange} accept=".csv,.xlsx,.xls" />
            </label>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {/* Exact Match Empty State Card from Screenshot */}
        {tables.length === 0 && !isUploading && (
          <div className="space-y-10 mt-2 px-1">
            <div className="bg-[#f0f7ff] border border-[#dcecfe] rounded-[2.5rem] p-8 text-center flex flex-col items-center">
              {/* Icon Flow */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-lg shadow-blue-500/5 flex items-center justify-center text-[#10b981]">
                  <FileSpreadsheet size={28} />
                </div>
                <ArrowRight size={18} className="text-blue-200" />
                <div className="w-14 h-14 bg-[#0066ff] rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center text-white">
                  <Cloud size={28} />
                </div>
              </div>

              {/* Text Area */}
              <div className="space-y-3 mb-10 px-2">
                <h3 className="text-xs font-black text-[#1e40af] uppercase tracking-wider">EMPTY KNOWLEDGE VAULT</h3>
                <p className="text-[13px] text-[#3b82f6] font-bold leading-relaxed">
                  Your local data is one click away from becoming insights.
                </p>
              </div>

              {/* Card Action Button */}
              <label className="w-full py-4 bg-white border border-[#dcecfe] text-[#0066ff] rounded-2xl text-[12px] font-black uppercase tracking-widest cursor-pointer hover:bg-blue-50 transition-all flex items-center justify-center shadow-sm active:scale-95">
                UPLOAD EXCEL / CSV
                <input type="file" className="hidden" onChange={handleFileChange} accept=".csv,.xlsx,.xls" />
              </label>
            </div>
            
            {/* Pro Tip Section */}
            <div className="px-5 py-2 border-l-2 border-[#dcecfe]">
               <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-loose">
                 PRO TIP: TABLES ARE PERSISTENT ACROSS YOUR NOTEBOOK SESSION.
               </p>
            </div>
          </div>
        )}

        {/* Table List Items */}
        {tables.map(table => (
          <div key={table.id} className="group">
            <button
              onClick={() => toggleTable(table.id)}
              className="w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all text-left"
            >
              <div className="shrink-0">
                {expanded[table.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
              <Table size={14} className="opacity-70 shrink-0" />
              <span className="truncate font-bold flex-1">{table.tableName}</span>

              <div className="flex items-center gap-1.5 min-w-[32px] justify-end shrink-0">
                {refreshing[table.tableName] ? (
                  <RefreshCw size={10} className="text-blue-500 animate-spin" />
                ) : (table.rowCount === -1 || table.rowCount === undefined) ? (
                  <div
                    onClick={(e) => handleRefresh(e, table.tableName)}
                    className="p-1 hover:bg-blue-100 rounded text-blue-500 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={10} />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 font-mono font-bold">
                      {table.rowCount.toLocaleString()}
                    </span>
                    <span
                      className="text-gray-300 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-blue-500 transition-all inline-flex p-0.5"
                      onClick={(e) => handleRefresh(e, table.tableName)}
                    >
                      <RefreshCw size={8} />
                    </span>
                  </div>
                )}
              </div>
            </button>

            {expanded[table.id] && (
              <div className="ml-8 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-2 mb-2">
                {table.columns.map(col => (
                  <div
                    key={col.name}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-blue-50 group/col cursor-help"
                  >
                    <span className="text-[11px] text-gray-500 font-mono font-bold truncate flex-1 group-hover/col:text-blue-600">
                      {col.name}
                    </span>
                    <div className="flex items-center gap-2 opacity-0 group-hover/col:opacity-100 transition-all flex-shrink-0 ml-2">
                      <span className="text-[9px] text-blue-400 font-black uppercase bg-blue-50 px-1 rounded">{col.type.split('(')[0]}</span>
                      <Info size={10} className="text-blue-300" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 bg-gray-50/50 text-[10px] text-gray-400 border-t border-gray-100 font-bold uppercase tracking-widest space-y-1 mt-auto">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isUploading ? 'bg-orange-500 animate-pulse' : 'bg-blue-500'}`}></div>
          {isUploading ? 'SYNCING TO CLUSTER...' : 'INFRASTRUCTURE ACTIVE'}
        </div>
      </div>
    </div>
  );
};

export default DataSidebar;
