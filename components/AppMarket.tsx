
import React, { useState } from 'react';
import { MOCK_APPS } from '../constants';
import { AppMarketItem, DevMode } from '../types';
import * as Icons from 'lucide-react';
import { X, Search, ChevronLeft, ArrowUpRight, User, Tag, Code2, PlayCircle, LayoutGrid, Monitor, BarChart3, ShieldCheck } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const AppMarket: React.FC<Props> = ({ onClose }) => {
  const [selectedApp, setSelectedApp] = useState<AppMarketItem | null>(null);
  const [search, setSearch] = useState('');

  const filteredApps = MOCK_APPS.filter(app => 
    app.name.toLowerCase().includes(search.toLowerCase()) || 
    app.category.toLowerCase().includes(search.toLowerCase())
  );

  const getIcon = (iconName: string, color: string, size = 24) => {
    const IconComponent = (Icons as any)[iconName] || Icons.HelpCircle;
    return <IconComponent size={size} style={{ color }} />;
  };

  return (
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
          
          {selectedApp && (
            <div className="flex items-center gap-3 h-8 pl-6 border-l border-gray-100">
               <button 
                onClick={() => setSelectedApp(null)}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded-lg transition-colors text-sm font-semibold text-gray-600"
              >
                <ChevronLeft size={16} />
                Back to List
              </button>
              <div className="h-4 w-px bg-gray-200"></div>
              <span className="text-sm font-bold text-blue-600">{selectedApp.name}</span>
            </div>
          )}
        </div>

        <button 
          onClick={onClose} 
          className="flex items-center gap-2 px-4 py-2 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-xl transition-all font-bold text-sm"
        >
          <X size={20} />
          Exit Market
        </button>
      </div>

      {!selectedApp ? (
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
            <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredApps.map(app => (
                <div 
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className="group bg-white border border-gray-100 rounded-[2.5rem] p-8 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer relative flex flex-col items-start text-left hover:-translate-y-2 duration-300"
                >
                  <div 
                    className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-sm"
                    style={{ backgroundColor: `${app.color}15` }}
                  >
                    {getIcon(app.icon, app.color, 32)}
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: app.color }}>{app.category}</span>
                      <ArrowUpRight size={18} className="text-gray-200 group-hover:text-blue-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                    </div>
                    <h4 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors mb-2">{app.name}</h4>
                    <p className="text-sm text-gray-500 line-clamp-2 font-medium leading-relaxed">{app.description}</p>
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
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden bg-white">
          {/* Detailed View Side Control */}
          <div className="w-[450px] border-r border-gray-100 flex flex-col bg-gray-50/50">
            <div className="p-12 space-y-8 flex-1 overflow-y-auto">
              <div 
                className="w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-2xl transition-transform hover:rotate-6"
                style={{ backgroundColor: selectedApp.color, boxShadow: `0 20px 40px ${selectedApp.color}30` }}
              >
                {getIcon(selectedApp.icon, '#FFF', 48)}
              </div>

              <div>
                <h3 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter leading-tight">{selectedApp.name}</h3>
                <p className="text-lg text-gray-500 font-medium leading-relaxed">{selectedApp.description}</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {[
                  { label: 'Developer', value: selectedApp.author, icon: User },
                  { label: 'Industry', value: selectedApp.category, icon: Tag },
                  { label: 'Core Engine', value: selectedApp.type === DevMode.SQL ? 'SQL Query Engine' : 'Python Runtime', icon: Code2 },
                  { label: 'Last Update', value: '2 hours ago', icon: Icons.Clock },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                      <item.icon size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.label}</p>
                      <p className="text-sm font-bold text-gray-800">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 bg-white border-t border-gray-100">
              <button className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-lg hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
                <PlayCircle size={24} />
                Launch Application
              </button>
            </div>
          </div>

          {/* App Preview Area */}
          <div className="flex-1 p-12 overflow-y-auto bg-white flex flex-col gap-10">
            <section>
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Monitor size={14} />
                  Live Preview Dashboard
                </h4>
                <div className="flex gap-2">
                   <div className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></div>
                      Streaming
                   </div>
                </div>
              </div>
              
              <div className="aspect-[16/9] bg-gray-50 rounded-[3rem] border-4 border-gray-50 flex flex-col items-center justify-center relative overflow-hidden group/preview shadow-inner">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5"></div>
                
                <div className="relative text-center space-y-6 max-w-md p-10 bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
                    <BarChart3 size={32} />
                  </div>
                  <div>
                    <h5 className="text-xl font-black text-gray-900 mb-2">Dashboard Loading</h5>
                    <p className="text-sm text-gray-500 font-medium leading-relaxed">Connecting to production data streams for high-fidelity visualization...</p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce"></div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-8">
               <div className="p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100">
                  <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <ShieldCheck size={14} />
                    Security & Compliance
                  </h5>
                  <div className="space-y-4">
                    {[
                      { l: 'Data Encryption', s: 'AES-256 Enabled' },
                      { l: 'Access Control', s: 'OAuth 2.0 / SSO' },
                      { l: 'Governance', s: 'SOC2 Compliant' },
                    ].map((row, i) => (
                      <div key={i} className="flex justify-between items-center py-3 border-b border-gray-200/50">
                        <span className="text-sm text-gray-500 font-medium">{row.l}</span>
                        <span className="text-sm text-gray-900 font-bold">{row.s}</span>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="p-8 bg-blue-600 rounded-[2.5rem] text-white flex flex-col justify-center shadow-2xl shadow-blue-500/20">
                  <p className="text-xs font-black text-blue-100 uppercase tracking-widest mb-2">Automated Efficiency (Simulated)</p>
                  <p className="text-5xl font-black mb-4">124<span className="text-2xl ml-2 opacity-50 font-medium uppercase">Hrs</span></p>
                  <p className="text-sm font-medium text-blue-100/80 leading-relaxed">Estimated monthly savings by automating recurring analysis workflows with AI-driven pipelines.</p>
               </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppMarket;
