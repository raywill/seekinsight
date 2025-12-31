import React, { useState, useRef } from 'react';
import { TableMetadata } from '../types';
import { 
  Database, 
  ChevronRight, 
  ChevronDown, 
  Table, 
  Hash, 
  Type, 
  Calendar, 
  AlignLeft, 
  MoreVertical, 
  UploadCloud, 
  Loader2, 
  RefreshCw,
  Plus,
  FileSpreadsheet
} from 'lucide-react';

interface Props {
  tables: TableMetadata[];
  onUploadFile: (file: File) => void;
  onRefreshTableStats: (tableName: string) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number | null;
  onLoadSample: () => void;
}

const DataSidebar: React.FC<Props> = ({ 
  tables, 
  onUploadFile, 
  onRefreshTableStats, 
  isUploading, 
  uploadProgress,
  onLoadSample
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getIconForType = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('int') || t.includes('float') || t.includes('double') || t.includes('decimal')) return <Hash size={12} className="text-blue-400" />;
    if (t.includes('date') || t.includes('time')) return <Calendar size={12} className="text-orange-400" />;
    if (t.includes('char') || t.includes('text')) return <AlignLeft size={12} className="text-green-400" />;
    return <Type size={12} className="text-gray-400" />;
  };

  return (
    <div className="w-72 bg-gray-50/50 border-r border-gray-200 flex flex-col h-full shrink-0">
      <div className="px-5 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Database size={14} className="text-blue-600" />
            Data Assets
          </h2>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">
            {tables.length}
          </span>
        </div>
        
        <div className="flex flex-col gap-2">
           {/* Upload Button */}
           <button 
             onClick={() => fileInputRef.current?.click()}
             disabled={isUploading}
             className="w-full py-2.5 px-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 active:scale-95"
           >
             {isUploading ? (
               <>
                 <Loader2 size={14} className="animate-spin" />
                 <span>Importing {uploadProgress !== null ? `${uploadProgress}%` : '...'}</span>
               </>
             ) : (
               <>
                 <UploadCloud size={14} />
                 <span>Import Data (CSV/Excel)</span>
               </>
             )}
           </button>
           <input 
             type="file" 
             ref={fileInputRef} 
             className="hidden" 
             accept=".csv,.xlsx,.xls,.txt" 
             onChange={onFileChange}
           />

           {/* Load Sample Button */}
           <button 
             onClick={onLoadSample}
             disabled={isUploading}
             className="w-full py-2.5 px-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 hover:border-blue-200 hover:text-blue-600 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 active:scale-95"
           >
              <FileSpreadsheet size={14} />
              <span>Load Sample Data</span>
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {tables.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-gray-400 font-medium mb-2">No tables found.</p>
            <p className="text-[10px] text-gray-300">Upload a file or load a sample dataset to get started.</p>
          </div>
        ) : (
          tables.map(table => (
            <div key={table.id} className="group">
              <button
                onClick={() => toggleTable(table.id)}
                className="w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all text-left group-hover:shadow-sm border border-transparent hover:border-blue-100"
              >
                {expanded[table.id] ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                <Table size={14} className="opacity-70 shrink-0" />
                <span className="truncate font-bold flex-1 text-[13px]" title={table.tableName}>{table.tableName}</span>

                <div className="flex items-center gap-1.5 min-w-[32px] justify-end">
                  {refreshing[table.tableName] ? (
                    <RefreshCw size={10} className="text-blue-500 animate-spin" />
                  ) : (table.rowCount === -1 || table.rowCount === undefined) ? (
                    <div
                      onClick={(e) => handleRefresh(e, table.tableName)}
                      className="p-1 hover:bg-blue-100 rounded text-blue-500 transition-colors cursor-pointer"
                      title="Fetch statistics"
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
                <div className="ml-2 pl-3 border-l-2 border-gray-100 my-1 space-y-0.5">
                  {table.columns.map(col => (
                    <div key={col.name} className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors group/col">
                      {getIconForType(col.type)}
                      <span className="truncate flex-1 font-medium" title={col.name}>{col.name}</span>
                      <span className="text-[9px] text-gray-300 uppercase font-mono group-hover/col:text-gray-400">{col.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DataSidebar;