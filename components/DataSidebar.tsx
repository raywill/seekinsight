
import React, { useState, useEffect, useRef } from 'react';
import { TableMetadata } from '../types';
import { Database, Table, ChevronDown, ChevronRight, Upload, Info, Loader2, RefreshCw, FileSpreadsheet, ArrowRight, Cloud, Download, Search, BrainCircuit, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  tables: TableMetadata[];
  onUploadFile: (file: File) => void;
  onRefreshTableStats: (tableName: string) => Promise<void>;
  onLoadSample: () => void;
  onConnectDB?: () => void; // New prop
  isUploading: boolean;
  uploadProgress?: number | null;
  width: number;
  onColumnAction?: (action: 'fulltext' | 'embedding', tableName: string, columnName: string) => void;
}

const DataSidebar: React.FC<Props> = ({ tables, onUploadFile, onRefreshTableStats, onLoadSample, onConnectDB, isUploading, uploadProgress, width, onColumnAction }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tableName: string;
    columnName: string;
    columnType: string;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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

  const handleContextMenu = (e: React.MouseEvent, tableName: string, columnName: string, columnType: string) => {
    // Check if type allows these actions
    const typeUpper = columnType.toUpperCase();
    const isString = typeUpper.includes('CHAR') || typeUpper.includes('TEXT');
    const isBinary = typeUpper.includes('BINARY') || typeUpper.includes('BLOB');

    if (isString || isBinary) {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            tableName,
            columnName,
            columnType
        });
    }
  };

  const handleMenuAction = (action: 'fulltext' | 'embedding') => {
      if (contextMenu && onColumnAction) {
          onColumnAction(action, contextMenu.tableName, contextMenu.columnName);
      }
      setContextMenu(null);
  };

  return (
    <div 
      className="bg-white border-r border-gray-200 flex flex-col h-full shadow-sm relative z-30 shrink-0"
      style={{ width }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
        <h2 className="text-sm font-black text-gray-800 flex items-center gap-2 uppercase tracking-tight">
          <Database size={16} className="text-blue-600" />
          {t('sidebar.title')}
        </h2>
        <div className="flex items-center gap-2">
          {isUploading && (
            <div className="flex items-center gap-1.5 text-blue-500 animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-tighter">
                {uploadProgress !== null ? `${uploadProgress}%` : t('sidebar.syncing')}
              </span>
            </div>
          )}
          <label className={`cursor-pointer p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`} title="Import data into Database">
            <Upload size={16} className="text-gray-500" />
            {!isUploading && <input type="file" className="hidden" onChange={handleFileChange} accept=".csv,.xlsx,.xls,.txt" />}
          </label>
        </div>
      </div>

      {/* Subtle Progress Bar */}
      {isUploading && uploadProgress !== null && (
        <div className="h-0.5 w-full bg-blue-50 shrink-0">
          <div 
            className="h-full bg-blue-500 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(59,130,246,0.4)]"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-1 relative">
        {tables.length === 0 && !isUploading && (
          <div className="space-y-4 mt-2">
            <div className="bg-[#ebf4ff] border border-[#d1e6ff] rounded-[2.5rem] p-8 text-center shadow-inner relative overflow-hidden flex flex-col items-center">
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-xl shadow-blue-500/5 flex items-center justify-center text-[#10b981] transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                  <FileSpreadsheet size={28} />
                </div>
                <div className="flex flex-col items-center justify-center">
                   <ArrowRight size={18} className="text-blue-300 animate-[bounce-x_1.5s_infinite]" />
                </div>
                <div className="w-14 h-14 bg-[#0066ff] rounded-2xl shadow-xl shadow-blue-500/30 flex items-center justify-center text-white transform rotate-3 hover:rotate-0 transition-transform duration-300">
                  <Cloud size={28} />
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <h3 className="text-xs font-black text-[#1e40af] uppercase tracking-wider">{t('sidebar.empty_title')}</h3>
                <p className="text-[11px] text-[#3b82f6] font-bold leading-relaxed px-2">
                  {t('sidebar.empty_desc')}
                </p>
              </div>

              <div className="w-full space-y-4">
                  {onConnectDB && (
                    <button 
                        onClick={onConnectDB}
                        className="w-full py-3.5 bg-purple-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <LinkIcon size={14} /> {t('sidebar.connect_db')}
                    </button>
                  )}

                  <label className="w-full py-3 bg-white border border-gray-200 text-gray-500 rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center active:scale-95 shadow-sm">
                    <Upload size={14} className="mr-2 opacity-60" /> {t('sidebar.upload_file')}
                    <input type="file" className="hidden" onChange={handleFileChange} accept=".csv,.xlsx,.xls,.txt" />
                  </label>
                  
                  <button 
                    onClick={onLoadSample}
                    className="w-full py-3.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer hover:bg-blue-100 hover:border-blue-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Download size={14} /> {t('sidebar.load_sample')}
                  </button>
              </div>
            </div>
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
              <span title={table.tableName} className="truncate font-bold flex-1">{table.tableName}</span>

              <div className="flex items-center gap-1.5 min-w-[32px] justify-end">
                {refreshing[table.tableName] ? (
                  <RefreshCw size={10} className="text-blue-500 animate-spin" />
                ) : (table.rowCount === -1 || table.rowCount === undefined) ? (
                  <div
                    onClick={(e) => handleRefresh(e, table.tableName)}
                    className="p-1 hover:bg-blue-100 rounded text-blue-500 transition-colors cursor-pointer"
                    title={t('sidebar.fetch_stats')}
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
                {table.columns.map(col => {
                  const tooltipKey = `${table.id}-${col.name}`;
                  const isTooltipActive = activeTooltip === tooltipKey;
                  const isInteractive = col.type.toUpperCase().includes('CHAR') || col.type.toUpperCase().includes('TEXT') || col.type.toUpperCase().includes('BINARY') || col.type.toUpperCase().includes('BLOB');
                  
                  return (
                    <div
                      key={col.name}
                      onContextMenu={(e) => handleContextMenu(e, table.tableName, col.name, col.type)}
                      className={`flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-blue-50 group/col relative select-none ${isInteractive ? 'cursor-context-menu' : ''}`}
                    >
                      <span className="text-[11px] text-gray-500 font-mono font-bold truncate flex-1 group-hover/col:text-blue-600">
                        {col.name}
                      </span>
                      <div className={`flex items-center gap-2 transition-all flex-shrink-0 ml-2 ${isTooltipActive ? 'opacity-100' : 'opacity-0 group-hover/col:opacity-100'}`}>
                        <span className="text-[9px] text-blue-400 font-black uppercase bg-blue-50 px-1 rounded">{col.type.split('(')[0]}</span>
                        
                        {/* Tooltip Icon & Bubble */}
                        <div className="relative flex items-center">
                          <button
                            onMouseEnter={() => setActiveTooltip(tooltipKey)}
                            onMouseLeave={() => setActiveTooltip(null)}
                            className={`transition-colors p-0.5 rounded-full ${isTooltipActive ? 'text-blue-600 bg-blue-100' : 'text-blue-300 hover:text-blue-500'}`}
                          >
                            <Info size={11} />
                          </button>
                          
                          {isTooltipActive && (
                            <div 
                              className="absolute right-0 bottom-full mb-2 w-64 bg-white border border-gray-200 p-3 rounded-xl shadow-xl z-[1000] animate-in fade-in zoom-in-95 duration-150 pointer-events-none"
                            >
                              <p className="text-[12px] font-medium leading-relaxed text-gray-600">
                                {col.comment || "No semantic description found for this column."}
                              </p>
                              {/* Bubble Tail */}
                              <div className="absolute top-full right-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" />
                              <div className="absolute top-full right-[7px] w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-gray-100 -mt-[1px]" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 bg-gray-50/50 text-[10px] text-gray-400 border-t border-gray-100 font-bold uppercase tracking-widest space-y-1 mt-auto">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isUploading ? 'bg-orange-500 animate-pulse' : 'bg-blue-500'}`}></div>
          {isUploading ? t('sidebar.syncing') : t('sidebar.infra_active')}
        </div>
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
           {t('sidebar.vpc_connected')}
        </div>
      </div>

      {/* Context Menu Portal */}
      {contextMenu && (
        <div 
            ref={menuRef}
            className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-gray-100 py-2 w-56 animate-in fade-in zoom-in-95 duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
        >
            <div className="px-4 py-2 border-b border-gray-50 mb-1">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    {contextMenu.tableName}.{contextMenu.columnName}
                </p>
            </div>
            <button 
                onClick={() => handleMenuAction('fulltext')}
                className="w-full text-left px-4 py-2 hover:bg-blue-50 flex items-center gap-3 text-xs font-bold text-gray-700 transition-colors"
            >
                <Search size={14} className="text-blue-500" />
                {t('sidebar.create_fulltext')}
            </button>
            <button 
                onClick={() => handleMenuAction('embedding')}
                className="w-full text-left px-4 py-2 hover:bg-purple-50 flex items-center gap-3 text-xs font-bold text-gray-700 transition-colors"
            >
                <BrainCircuit size={14} className="text-purple-500" />
                {t('sidebar.create_embedding')}
            </button>
        </div>
      )}

      <style>{`
        @keyframes bounce-x {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(6px); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default DataSidebar;
