
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
      {/* Header with fixed Upload Button style */}
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
        <h2 className="text-sm font-black text-gray-800 flex items-center gap-2 uppercase tracking-tight">
          <Database size={16} className="text-blue-600" />
          Data Explorer
        </h2>
        <div className="flex items-center gap-2">
          {isUploading && (
            <div className="flex items-center gap-1 text-blue-500 animate-pulse mr-1">
              <Loader2 size={12} className="animate-spin" />
              <span className="text-[10px] font-bold uppercase">Sync</span>
            </div>
          )}
          <label className={`cursor-pointer p-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all shadow-md active:scale-90 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`} title="Import data into Database">
            <Upload size={14} />
            {!isUploading && <input type="file" className="hidden" onChange={handleFileChange} accept=".csv,.xlsx,.xls" />}
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Enhanced Empty State Card */}
        {tables.length === 0 && !isUploading && (
          <div className="mx-2 mt-4 space-y-4">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-6 text-center shadow-xl shadow-blue-500/20 relative overflow-hidden group">
              {/* Decorative elements */}
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
              <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-indigo-400/20 rounded-full blur-2xl"></div>
              
              <div className="flex items-center justify-center gap-3 mb-6 relative z-10">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20 transform group-hover:-rotate-12 transition-transform">
                  <FileSpreadsheet size={24} />
                </div>
                <div className="flex flex-col items-center">
                   <ArrowRight size={16} className="text-blue-200 animate-pulse" />
                </div>
                <div className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center text-blue-600 transform group-hover:rotate-12 transition-transform">
                  <Cloud size={24} />
                </div>
              </div>

              <div className="space-y-2 relative z-10 mb-6">
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Empty Data Hub</h3>
                <p className="text-[11px] text-blue-100 font-medium leading-relaxed opacity-80 px-2">
                  Personal Knowledge Graph needs fuel. Import your Excel/CSV to start AI analysis.
                </p>
              </div>

              <label className="relative z-10 block w-full py-3.5 bg-white text-blue-600 rounded-2xl text-[11px] font-black uppercase tracking-widest cursor-pointer hover:bg-blue-50 hover:scale-[1.02] transition-all active:scale-95 shadow-lg">
                Click to Upload
                <input type="file" className="hidden" onChange={handleFileChange} accept=".csv,.xlsx,.xls" />
              </label>
            </div>
            
            <div className="px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
               <div className="flex items-center gap-2 text-blue-500 mb-1">
                 <Info size={12} />
                 <span className="text-[9px] font-black uppercase tracking-widest">Storage Info</span>
               </div>
               <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                 Data is stored in your private OceanBase tenant and is persistent across sessions.
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
                    className="p-1.5 hover:bg-blue-100 rounded text-blue-500 transition-colors cursor-pointer"
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
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-blue-50 group/col cursor-help relative"
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

      <div className="p-4 bg-gray-50/50 text-[10px] text-gray-400 border-t border-gray-100 font-bold uppercase tracking-widest space-y-1">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isUploading ? 'bg-orange-500 animate-pulse' : 'bg-blue-500'}`}></div>
          {isUploading ? 'Syncing to OceanBase...' : 'Engine Active'}
        </div>
      </div>
    </div>
  );
};

export default DataSidebar;
