
import React, { useState, useEffect } from 'react';
import { Notebook } from '../types';
import { Boxes, LayoutGrid, Loader2, ArrowRight, Trash2, Calendar, Plus, Database, Globe, Zap, Eye, LayoutList } from 'lucide-react';
import * as Icons from 'lucide-react';

interface Props {
  onOpen: (nb: Notebook) => void;
  onOpenMarket: () => void;
}

const Lobby: React.FC<Props> = ({ onOpen, onOpenMarket }) => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const gatewayUrl = (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';

  const fetchNotebooks = () => {
    fetch(`${gatewayUrl}/notebooks`)
      .then(res => {
        if (!res.ok) throw new Error("Gateway Error");
        return res.json();
      })
      .then(data => {
        setNotebooks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch notebooks:", err);
        setNotebooks([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchNotebooks();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${gatewayUrl}/notebooks`, { method: 'POST' });
      if (!res.ok) throw new Error("Create Failed");
      const nb = await res.json();
      onOpen(nb);
    } catch (e) {
      alert("创建失败: 请检查后端服务是否启动并配置正确");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("确定要彻底删除这个 Notebook 及其所有物理数据吗？")) return;
    try {
      await fetch(`${gatewayUrl}/notebooks/${id}`, { method: 'DELETE' });
      fetchNotebooks();
    } catch (e) {
      alert("删除失败");
    }
  };

  const handleOpenNotebook = (nb: Notebook) => {
      // Send view increment
      fetch(`${gatewayUrl}/notebooks/${nb.id}/view`, { method: 'POST' }).catch(console.warn);
      onOpen(nb);
  };

  const renderIcon = (name: string) => {
    try {
      const IconComponent = (Icons as any)[name];
      if (typeof IconComponent !== 'function') return <Database size={20} />;
      return <IconComponent size={20} />;
    } catch (e) {
      return <Database size={20} />;
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white gap-6">
      <Loader2 className="animate-spin text-blue-600" size={64} />
      <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Accessing Insight Vault...</h1>
    </div>
  );

  return (
    <div className="h-screen bg-gray-50/50 p-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20"><Boxes className="text-white" size={28} /></div>
             <div>
               <div className="relative inline-flex items-center">
                  <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none">SeekInsight</h1>
                  <span className="absolute -top-2 -right-16 bg-blue-50 text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded-md border border-blue-100 lowercase tracking-tight transform rotate-3 shadow-sm select-none">for seekdb</span>
               </div>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Personal Knowledge Graph</p>
             </div>
          </div>

          <div className="flex items-center gap-6">
              {/* View Toggle */}
              <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-gray-100 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Grid View"
                  >
                     <LayoutGrid size={18} />
                  </button>
                  <div className="w-px bg-gray-100 mx-1 my-1"></div>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-gray-100 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    title="List View"
                  >
                     <LayoutList size={18} />
                  </button>
              </div>

              {/* Restore Create Button */}
              <button 
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
              >
                 {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
                 <span>CREATE NEW NOTEBOOK</span>
              </button>
          </div>
        </header>

        {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            
            {/* Card 1: Marketplace Entry - Option A (Deep Royal Blue) */}
            <div 
                onClick={onOpenMarket}
                className="group relative overflow-hidden bg-gradient-to-br from-[#0f172a] to-[#1e3a8a] rounded-3xl p-6 cursor-pointer hover:shadow-2xl hover:shadow-blue-900/30 transition-all text-white min-h-[180px] flex flex-col justify-between hover:-translate-y-1 duration-300"
            >
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Globe size={100} />
                </div>
                <div className="flex justify-between items-start mb-5 relative z-10">
                    <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 group-hover:bg-white/20 transition-colors">
                    <LayoutGrid size={20} className="text-sky-300" />
                    </div>
                </div>
                <div className="relative z-10">
                    <h3 className="text-lg font-black text-white mb-1 tracking-tight">App Marketplace</h3>
                    <p className="text-xs font-medium text-blue-200/80">Explore community templates & clone ready-made apps.</p>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-300 uppercase tracking-widest">
                        <Zap size={12} className="fill-sky-300" />
                        Featured
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-blue-500 transition-colors">
                        <ArrowRight size={14} />
                    </div>
                </div>
            </div>

            {/* Card 2: Create New (Alternative Entry - kept in Grid for convenience) */}
            <div 
                onClick={handleCreate}
                className={`group bg-white border-2 border-dashed border-gray-200 rounded-3xl p-6 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer flex flex-col justify-center items-center gap-4 min-h-[180px] ${creating ? 'opacity-50 pointer-events-none' : ''}`}
            >
                <div className="w-16 h-16 rounded-full bg-gray-50 group-hover:bg-white group-hover:shadow-md flex items-center justify-center transition-all text-gray-300 group-hover:text-blue-500">
                    {creating ? <Loader2 className="animate-spin" size={24} /> : <Plus size={32} />}
                </div>
                <h3 className="text-sm font-black text-gray-400 group-hover:text-blue-600 uppercase tracking-widest transition-colors">Create New Notebook</h3>
            </div>

            {/* Existing Notebooks */}
            {notebooks.map(nb => (
                <div
                key={nb.id}
                onClick={() => handleOpenNotebook(nb)}
                className="group bg-white border border-gray-100 rounded-3xl p-6 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[180px]"
                >
                    <div className="flex justify-between items-start mb-5">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl transition-transform group-hover:scale-110">
                        {renderIcon(nb.icon_name)}
                    </div>
                    <button
                        onClick={(e) => handleDelete(e, nb.id)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <Trash2 size={16} />
                    </button>
                    </div>
                    
                    <div>
                    <h3 className="text-lg font-black text-gray-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-1 leading-tight">
                        {nb.topic}
                    </h3>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <Calendar size={12} />
                        {new Date(nb.created_at).toLocaleDateString()}
                        </div>
                        {nb.views !== undefined && nb.views > 0 && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded-md">
                            <Eye size={10} /> {nb.views}
                            </div>
                        )}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <ArrowRight size={14} />
                    </div>
                    </div>
                </div>
            ))}
            </div>
        ) : (
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                {/* Marketplace Banner for List View - Option A (Deep Royal Blue) */}
                <div 
                    onClick={onOpenMarket}
                    className="flex items-center justify-between p-6 bg-gradient-to-r from-[#0f172a] to-[#1e3a8a] rounded-2xl text-white cursor-pointer hover:shadow-xl hover:shadow-blue-900/20 transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                            <Globe size={24} className="text-sky-300" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">App Marketplace</h3>
                            <p className="text-xs text-blue-200/80 font-medium">Explore and clone community templates</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 pr-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-sky-300 bg-sky-400/10 px-2 py-1 rounded-lg">Featured</span>
                        <ArrowRight className="text-slate-500 group-hover:text-white transition-colors" />
                    </div>
                </div>

                {/* List Container */}
                <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
                    {notebooks.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center gap-4">
                             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                                <Database size={24} />
                             </div>
                             <div>
                                <h3 className="text-gray-900 font-bold">No notebooks yet</h3>
                                <p className="text-gray-400 text-sm">Create your first notebook to get started</p>
                             </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {notebooks.map(nb => (
                                <div 
                                    key={nb.id} 
                                    onClick={() => handleOpenNotebook(nb)}
                                    className="group flex items-center justify-between p-4 hover:bg-blue-50/30 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-5 flex-1 min-w-0">
                                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-105 transition-transform shrink-0">
                                            {renderIcon(nb.icon_name)}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-black text-base text-gray-900 group-hover:text-blue-600 transition-colors truncate">{nb.topic}</h3>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                                    <Calendar size={12} /> {new Date(nb.created_at).toLocaleDateString()}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                <span className="text-xs text-gray-400 font-medium font-mono">ID: {nb.id.substring(0,6)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 pl-4">
                                        {nb.views !== undefined && nb.views > 0 && (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                                                <Eye size={12} /> {nb.views}
                                            </div>
                                        )}
                                        
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => handleDelete(e, nb.id)}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Delete Notebook"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <div className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-300 group-hover:border-blue-200 group-hover:text-blue-500 transition-colors shadow-sm">
                                                <ArrowRight size={14} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        <div className="flex-1 flex overflow-hidden"></div> {/* Placeholder for flex consistency if needed */}

        <div className="flex justify-center pt-16 pb-6 opacity-60 hover:opacity-100 transition-opacity duration-300">
           <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] flex items-center gap-3 cursor-default select-none hover:text-blue-400 transition-colors">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse"></div>
              powered by seekdb
           </span>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
