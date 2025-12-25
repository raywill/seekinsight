
import React, { useState } from 'react';
import { TableMetadata } from '../types';
import { Database, Table, ChevronDown, ChevronRight, Upload, Info, Loader2, RefreshCw } from 'lucide-react';

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
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
        <h2 className="text-sm font-black text-gray-800 flex items-center gap-2 uppercase tracking-tight">
          <Database size={16} className="text-blue-600" />
          Data Sources
        </h2>
        <div className="flex items-center gap-2">
          {isUploading ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold">
              <Loader2 size={12} className="animate-spin" />
              Syncing
            </div>
          ) : (
            <label className="cursor-pointer p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200" title="Import data into Database">
              <Upload size={16} className="text-gray-500" />
              <input type="file" className="hidden" onChange={handleFileChange} accept=".csv,.xlsx,.xls" />
            </label>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {tables.length === 0 && !isUploading && (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No Tables</p>
            <p className="text-[10px] text-gray-300 font-medium">Click the upload icon to import local files to the cloud database.</p>
          </div>
        )}

        {tables.map(table => (
          <div key={table.id} className="group">
            <button
              onClick={() => toggleTable(table.id)}
              className="w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all text-left"
            >
              {expanded[table.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Table size={14} className="opacity-70" />
              <span className="truncate font-bold flex-1">{table.tableName}</span>

              <div className="flex items-center gap-1.5 min-w-[32px] justify-end">
                {refreshing[table.tableName] ? (
                  <RefreshCw size={10} className="text-blue-500 animate-spin" />
                ) : table.rowCount === -1 ? (
                  <div
                    onClick={(e) => handleRefresh(e, table.tableName)}
                    className="p-1 hover:bg-blue-100 rounded text-blue-500 transition-colors"
                    title="Click to fetch row count"
                  >
                    <RefreshCw size={10} />
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span
                      className="text-[10px] text-gray-400 font-mono"
                    >
                      {table.rowCount.toLocaleString()}
                    </span>
                    <span
                      className="text-gray-300 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-blue-500 transition-all inline-flex"
                      onClick={(e) => handleRefresh(e, table.tableName)}
                      title="Click to refresh row count"
                    >
                      <RefreshCw size={8} />
                    </span>
                  </div>
                )}
              </div>
            </button>

            {expanded[table.id] && (
              <div className="ml-8 mt-1 space-y-0.5 border-l-2 border-gray-50 pl-2 mb-2">
                {table.columns.map(col => (
                  <div
                    key={col.name}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-blue-50 group/col cursor-help relative"
                    title={`Column: ${col.name}\nDescription: ${col.comment || 'N/A'}\nType: ${col.type}`}
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
          {isUploading ? 'Writing to Cluster...' : 'Infrastructure Connected'}
        </div>
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
           MySQL 5.7 Protocol Ready
        </div>
      </div>
    </div>
  );
};

export default DataSidebar;