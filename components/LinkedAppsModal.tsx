
import React, { useEffect, useState } from 'react';
import { PublishedApp } from '../types';
import { fetchApps } from '../services/appService';
import { X, Edit, Eye, Loader2, Rocket, FileQuestion } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  notebookId: string;
  onEdit: (app: PublishedApp) => void;
  onView: (appId: string) => void;
}

const LinkedAppsModal: React.FC<Props> = ({ isOpen, onClose, notebookId, onEdit, onView }) => {
  const [apps, setApps] = useState<PublishedApp[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && notebookId) {
      setLoading(true);
      fetchApps().then(allApps => {
        const linked = allApps.filter(a => a.source_notebook_id === notebookId);
        setApps(linked);
        setLoading(false);
      });
    }
  }, [isOpen, notebookId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Rocket size={18} className="text-blue-600" />
            Linked Apps
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider">Fetching Apps...</span>
            </div>
          ) : apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
              <FileQuestion size={32} className="opacity-20" />
              <p className="text-sm font-medium">No apps published from this notebook yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apps.map(app => (
                <div key={app.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
                  <div className="min-w-0 flex-1 mr-4">
                    <h4 className="text-sm font-bold text-gray-900 truncate" title={app.title}>{app.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${app.type === 'SQL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {app.type}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium truncate">
                        {new Date(app.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { onClose(); onEdit(app); }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit App"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => { onClose(); onView(app.id); }}
                      className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="View App"
                    >
                      <Eye size={16} />
                    </button>
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

export default LinkedAppsModal;
