
import React, { useState, useEffect } from 'react';
import { PublishedApp, DevMode } from '../types';
import { fetchApps, deleteApp } from '../services/appService';
import * as Icons from 'lucide-react';
import { X, Search, ChevronLeft, ArrowUpRight, User, Tag, Code2, PlayCircle, LayoutGrid, Monitor, BarChart3, ShieldCheck, Loader2, Trash2 } from 'lucide-react';
import AppViewer from './AppViewer';

interface Props {
  onClose: () => void;
  onLoadApp?: (app: PublishedApp) => void;
  onOpenApp?: (appId: string) => void; // New prop for URL routing
  onEditApp?: (app: PublishedApp) => void;
  onCloneApp?: (app: PublishedApp) => void;
}

const AppMarket: React.FC<Props> = ({ onClose, onLoadApp, onOpenApp, onEditApp, onCloneApp }) => {
  const [apps, setApps] = useState<PublishedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = () => {
    setLoading(true);
    fetchApps().then(data => {
      setApps(data);
      setLoading(false);
    });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!confirm("Are you sure you want to delete this app?")) return;
      setDeletingId(id);
      const success = await deleteApp(id);
      if (success) {
          setApps(prev => prev.filter(a => a.id !== id));
      } else {
          alert("Failed to delete app");
      }
      setDeletingId(null);
  }

  const filteredApps = apps.filter(app => 
    app.title.toLowerCase().includes(search.toLowerCase()) || 
    (app.description && app.description.toLowerCase().includes(search.toLowerCase()))
  );

  const getIcon = (iconName: string = 'LayoutGrid', color: string = '#3B82F6', size = 24) => {
    const IconComponent = (Icons as any)[iconName] || Icons.HelpCircle;
    return <IconComponent size={size} style={{ color }} />;
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Full-Screen Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-20">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <LayoutGrid size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 leading-tight">Marketplace</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Global Data Portfolio</p>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="flex items-center gap-2 px-4 py-2 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-xl transition-all font-bold text-sm"
          >
            <X size={20} />
            Exit Market
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/30">
            {/* Search Bar Area */}
            <div className="px-8 py-10 max-w-5xl mx-auto w-full">
              <div className="text-center mb-10">
                <h3 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Discover the Power of Data Apps</h3>
                <p className="text-gray-500 font-medium">Browse featured use-cases published and deployed by the SeekInsight community</p>
              </div>
              <div className="relative group max-w-3xl mx-auto">
                <input 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search for finance, growth, logistics templates..."
                  className="w-full pl-14 pr-6 py-5 bg-white border-2 border-transparent rounded-3xl text-lg focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500 shadow-xl shadow-gray-200/50 transition-all placeholder:text-gray-300"
                />
                <Search size={24} className="absolute left-5 top-5 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
              </div>
            </div>

            {/* Apps Grid */}
            <div className="flex-1 overflow-y-auto px-8 pb-20">
              {loading ? (
                 <div className="flex justify-center py-20">
                    <Loader2 size={40} className="animate-spin text-blue-300" />
                 </div>
              ) : (
                <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {filteredApps.map(app => (
                    <div 
                      key={app.id}
                      onClick={() => onOpenApp?.(app.id)}
                      className="group bg-white border border-gray-100 rounded-[2.5rem] p-8 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer relative flex flex-col items-start text-left hover:-translate-y-2 duration-300"
                    >
                      <div className="flex justify-between w-full">
                          <div 
                            className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-sm"
                            style={{ backgroundColor: `${app.color || '#3B82F6'}15` }}
                          >
                            {getIcon(app.icon, app.color || '#3B82F6', 32)}
                          </div>
                          
                          <button
                            onClick={(e) => handleDelete(e, app.id)}
                            className="p-2 h-10 w-10 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete App"
                          >
                             {deletingId === app.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex items-center justify-between w-full mb-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: app.color || '#3B82F6' }}>{app.category || 'General'}</span>
                          <ArrowUpRight size={18} className="text-gray-200 group-hover:text-blue-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                        </div>
                        <h4 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors mb-2 line-clamp-1">{app.title}</h4>
                        <p className="text-sm text-gray-500 line-clamp-2 font-medium leading-relaxed">{app.description || "No description."}</p>
                      </div>

                      <div className="mt-auto pt-6 border-t border-gray-50 w-full flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase">
                            {app.author[0]}
                          </div>
                          <span className="text-xs font-bold text-gray-400">{app.author}</span>
                        </div>
                        <div className="px-2 py-1 bg-gray-50 rounded text-[9px] font-black text-gray-400 uppercase">
                          {app.type}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>
      </div>
    </>
  );
};

export default AppMarket;
