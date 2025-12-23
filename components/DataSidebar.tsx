
import React, { useState } from 'react';
import { TableMetadata } from '../types';
import { Database, Table, ChevronDown, ChevronRight, Upload, Info, Loader2 } from 'lucide-react';

interface Props {
  tables: TableMetadata[];
  onUploadFile: (file: File) => void;
  isUploading: boolean;
}

const DataSidebar: React.FC<Props> = ({ tables, onUploadFile, isUploading }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleTable = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
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
        <h2 className="text-sm font-black text-gray-800 flex items-center gap-2">
          <Database size={16} className="text-blue-600" />
          MySQL 数据库
        </h2>
        <div className="flex items-center gap-2">
          {isUploading ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold">
              <Loader2 size={12} className="animate-spin" />
              正在同步
            </div>
          ) : (
            <label className="cursor-pointer p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200" title="导入数据到 MySQL">
              <Upload size={16} className="text-gray-500" />
              <input type="file" className="hidden" onChange={handleFileChange} accept=".csv,.xlsx,.xls" />
            </label>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {tables.length === 0 && !isUploading && (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">无可用表</p>
            <p className="text-[10px] text-gray-300">点击上传按钮将本地文件解析并同步至云端数据库</p>
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
              <span className="text-[10px] text-gray-400 font-mono group-hover:text-blue-400">
                {table.rowCount.toLocaleString()}
              </span>
            </button>

            {expanded[table.id] && (
              <div className="ml-8 mt-1 space-y-0.5 border-l-2 border-gray-50 pl-2 mb-2">
                {table.columns.map(col => (
                  <div 
                    key={col.name} 
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-blue-50 group/col cursor-help relative"
                    title={`字段: ${col.name}\n备注: ${col.comment || '无描述'}\n类型: ${col.type}`}
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
        <p className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isUploading ? 'bg-orange-500 animate-pulse' : 'bg-blue-500'}`}></div>
          {isUploading ? '正在写入集群...' : 'OceanBase 集群已连接'}
        </p>
        <p className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
           MySQL 5.7 协议就绪
        </p>
      </div>
    </div>
  );
};

export default DataSidebar;
