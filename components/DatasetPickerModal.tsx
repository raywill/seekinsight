
import React from 'react';
import { Dataset } from '../types';
import { X, Database, ShoppingBag, Users, Film, ArrowRight, Loader2, Table } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (dataset: Dataset) => void;
  isLoading: boolean;
  datasets: Dataset[];
}

const DatasetPickerModal: React.FC<Props> = ({ isOpen, onClose, onSelect, isLoading, datasets }) => {
  if (!isOpen) return null;

  const getIcon = (name: string) => {
    switch (name) {
      case 'ShoppingBag': return <ShoppingBag size={24} />;
      case 'Users': return <Users size={24} />;
      case 'Film': return <Film size={24} />;
      default: return <Database size={24} />;
    }
  };

  const getColor = (name: string) => {
    switch (name) {
      case 'ShoppingBag': return 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white';
      case 'Users': return 'bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white';
      case 'Film': return 'bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 leading-none">Sample Datasets</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Jumpstart your analysis</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"><X size={20}/></button>
        </div>

        {/* Content */}
        <div className="p-8 bg-gray-50/30">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-indigo-100 rounded-full animate-ping absolute inset-0"></div>
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center relative shadow-sm border border-indigo-100">
                        <Loader2 size={32} className="animate-spin" />
                    </div>
                </div>
                <div className="text-center">
                    <h4 className="font-black text-indigo-900">Cloning Dataset...</h4>
                    <p className="text-xs text-indigo-400 font-medium mt-1">Copying tables from master vault</p>
                </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {datasets.map((ds) => (
                <div 
                  key={ds.id}
                  onClick={() => onSelect(ds)}
                  className="group bg-white border border-gray-200 rounded-2xl p-5 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer transition-all relative flex flex-col"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${getColor(ds.icon)}`}>
                      {getIcon(ds.icon)}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 text-indigo-600 p-1.5 rounded-full">
                        <ArrowRight size={16} />
                    </div>
                  </div>
                  
                  <h4 className="text-sm font-black text-gray-900 group-hover:text-indigo-600 transition-colors mb-1">{ds.title}</h4>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed mb-4">{ds.description}</p>
                  
                  <div className="mt-auto pt-4 border-t border-gray-50 flex items-center gap-2">
                    <Table size={12} className="text-gray-300" />
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-tight">
                        {ds.tables.join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatasetPickerModal;
