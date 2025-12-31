
import React from 'react';
import { Dataset } from '../types';
import { X, ShoppingCart, Users, Film, Activity, Loader2, Download, Database } from 'lucide-react';
import * as Icons from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (dataset: Dataset) => void;
  isLoading: boolean;
  datasets: Dataset[];
}

const DatasetPickerModal: React.FC<Props> = ({ isOpen, onClose, onSelect, isLoading, datasets }) => {
  if (!isOpen) return null;

  const getIcon = (iconName: string, colorClass: string) => {
    try {
      const IconComponent = (Icons as any)[iconName] || Database;
      // Extract color text (e.g., "text-orange-500") to use as class, or map to hex
      return <IconComponent size={24} className={colorClass} />;
    } catch (e) {
      return <Database size={24} className="text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 leading-none">Load Sample Dataset</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Populate your empty database</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
          {isLoading && datasets.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64">
                <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
                <p className="text-sm font-bold text-gray-400">Loading datasets...</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {datasets.map(dataset => (
                <button
                  key={dataset.id}
                  onClick={() => onSelect(dataset)}
                  className="group relative flex flex-col text-left bg-white border border-gray-200 rounded-3xl p-6 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all active:scale-[0.99] overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                     {getIcon(dataset.icon, 'text-gray-900')}
                  </div>
                  
                  <div className="flex items-start gap-4 mb-4">
                     <div className={`p-3 rounded-2xl bg-gray-50 group-hover:bg-white group-hover:shadow-md transition-all ${dataset.color}`}>
                        {getIcon(dataset.icon, dataset.color)}
                     </div>
                     <div>
                        <h4 className="text-base font-black text-gray-900 group-hover:text-blue-600 transition-colors">{dataset.name}</h4>
                        <p className="text-xs text-gray-500 mt-1 font-medium leading-relaxed">{dataset.description}</p>
                     </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-50">
                     <div className="flex flex-wrap gap-2 mb-3">
                        {dataset.tables.map(t => (
                           <span key={t} className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-md font-mono border border-gray-200 group-hover:border-blue-100 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                             {t}
                           </span>
                        ))}
                     </div>
                     <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400 group-hover:text-blue-500 transition-colors">
                        <span className="flex items-center gap-1"><Activity size={12} /> {dataset.topicName}</span>
                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                           <Download size={12} /> Load Data
                        </div>
                     </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 flex-col gap-4">
                 <Loader2 size={48} className="animate-spin text-blue-600" />
                 <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest animate-pulse">Cloning Dataset...</h3>
            </div>
        )}
      </div>
    </div>
  );
};

export default DatasetPickerModal;
