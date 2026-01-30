
import React, { useState, useEffect } from 'react';
import { X, Database, Search, Loader2, Link as LinkIcon, RefreshCw, Eye, ArrowLeft, Table, Globe, Server } from 'lucide-react';
import { getDatabaseEngine } from '../services/dbService';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (dbName: string) => Promise<void>;
  isLoading?: boolean;
  connectionStatus?: string; // New prop for detailed status message
}

interface ExternalDbConfig {
  type: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

const ConnectDatabaseModal: React.FC<Props> = ({ isOpen, onClose, onConnect, isLoading, connectionStatus }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal');
  const [databases, setDatabases] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState('');
  const [connectingDb, setConnectingDb] = useState<string | null>(null);
  
  // External DB Form
  const [externalConfig, setExternalConfig] = useState<ExternalDbConfig>({
    type: (typeof process !== 'undefined' ? process.env.DB_TYPE : 'mysql') || 'mysql',
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: '',
    database: ''
  });

  // Preview Mode State
  const [previewDb, setPreviewDb] = useState<string | null>(null);
  const [previewTables, setPreviewTables] = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const gatewayUrl = (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';

  useEffect(() => {
    if (isOpen) {
      fetchDatabases();
      // Reset view state on open
      setPreviewDb(null);
      setPreviewTables([]);
      setActiveTab('internal');
    }
  }, [isOpen]);

  // Auto-set default port based on type
  useEffect(() => {
      setExternalConfig(prev => ({
          ...prev,
          port: prev.type === 'postgres' ? '5432' : '3306'
      }));
  }, [externalConfig.type]);

  const fetchDatabases = async () => {
    setFetching(true);
    try {
      const res = await fetch(`${gatewayUrl}/databases`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setDatabases(data);
      }
    } catch (e) {
      console.error("Failed to fetch databases", e);
    } finally {
      setFetching(false);
    }
  };

  const handleConnect = async (db: string) => {
    setConnectingDb(db);
    try {
        await onConnect(db);
        onClose();
    } finally {
        setConnectingDb(null);
    }
  };

  const handleExternalConnect = () => {
      const { type, host, port, user, password, database } = externalConfig;
      if (!host || !port || !user || !database) return;
      
      // Construct URI: type://user:pass@host:port/db
      // FIX: Encode user AND password to handle special chars like '@' or ':' in username/password
      const encodedUser = encodeURIComponent(user);
      const encodedPass = password ? `:${encodeURIComponent(password)}` : '';
      const uri = `${type}://${encodedUser}${encodedPass}@${host}:${port}/${database}`;
      
      handleConnect(uri);
  };

  const handleViewTables = async (db: string) => {
      setPreviewDb(db);
      setLoadingPreview(true);
      try {
          // Use the db service to fetch tables for the specific DB
          const engine = getDatabaseEngine();
          const tables = await engine.getTables(db);
          setPreviewTables(tables.map(t => t.tableName));
      } catch (e) {
          console.error("Failed to fetch tables preview", e);
          setPreviewTables([]);
      } finally {
          setLoadingPreview(false);
      }
  };

  const handleBackToDatabases = () => {
      setPreviewDb(null);
      setPreviewTables([]);
  };

  const filteredDbs = databases.filter(db => db.toLowerCase().includes(search.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!isLoading && !connectingDb ? onClose : undefined}></div>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600 rounded-xl text-white shadow-lg shadow-purple-500/20">
              <LinkIcon size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 leading-none">
                  {previewDb ? `${t('connect.preview')}: ${previewDb}` : t('connect.title')}
              </h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  {previewDb ? 'Schema Inspection' : 'Switch Context & Enrich Metadata'}
              </p>
            </div>
          </div>
          {!isLoading && !connectingDb && (
             <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"><X size={20}/></button>
          )}
        </div>

        {!previewDb && (
            <div className="px-8 pt-4 pb-2">
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('internal')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'internal' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Database size={14} /> Internal DB
                    </button>
                    <button 
                        onClick={() => setActiveTab('external')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'external' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Globe size={14} /> External DB
                    </button>
                </div>
            </div>
        )}

        {/* INTERNAL DB TAB */}
        {activeTab === 'internal' && !previewDb && (
            <div className="p-4 border-b border-gray-100 mx-4">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('connect.search_placeholder')}
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                </div>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 bg-white relative">
          
          {/* Main Database List View */}
          {activeTab === 'internal' && !previewDb && (
              fetching ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
                    <Loader2 size={24} className="animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-wider">{t('connect.scan')}</span>
                </div>
              ) : filteredDbs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
                <Database size={32} className="opacity-20" />
                <p className="text-sm font-medium">{t('connect.no_dbs')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                {filteredDbs.map(db => (
                    <div key={db} className="group flex items-center justify-between p-3 hover:bg-purple-50 rounded-xl transition-colors border border-transparent hover:border-purple-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center group-hover:bg-purple-200 group-hover:text-purple-700 transition-colors">
                            <Database size={16} />
                        </div>
                        <span className="text-sm font-bold text-gray-700 group-hover:text-purple-900">{db}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleViewTables(db)}
                            disabled={!!connectingDb}
                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                            title="Preview Tables"
                        >
                            <Eye size={16} />
                        </button>
                        <button 
                            onClick={() => handleConnect(db)}
                            disabled={!!connectingDb}
                            className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg shadow-sm group-hover:border-purple-200 group-hover:text-purple-600 hover:bg-purple-600 hover:!text-white transition-all disabled:opacity-50"
                        >
                            {connectingDb === db ? <Loader2 size={14} className="animate-spin" /> : t('connect.connect_btn')}
                        </button>
                    </div>
                    </div>
                ))}
                </div>
              )
          )}

          {/* External Connection Form */}
          {activeTab === 'external' && (
              <div className="p-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Type</label>
                          <select 
                            value={externalConfig.type}
                            onChange={e => setExternalConfig({...externalConfig, type: e.target.value})}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-purple-400"
                          >
                              <option value="mysql">MySQL</option>
                              <option value="postgres">PostgreSQL</option>
                          </select>
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Host</label>
                          <input 
                            value={externalConfig.host}
                            onChange={e => setExternalConfig({...externalConfig, host: e.target.value})}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-purple-400"
                            placeholder="127.0.0.1"
                          />
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Port</label>
                          <input 
                            value={externalConfig.port}
                            onChange={e => setExternalConfig({...externalConfig, port: e.target.value})}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-purple-400"
                            placeholder="3306"
                          />
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Database</label>
                          <input 
                            value={externalConfig.database}
                            onChange={e => setExternalConfig({...externalConfig, database: e.target.value})}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-purple-400"
                            placeholder="my_db"
                          />
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">User</label>
                          <input 
                            value={externalConfig.user}
                            onChange={e => setExternalConfig({...externalConfig, user: e.target.value})}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-purple-400"
                            placeholder="root"
                          />
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Password</label>
                          <input 
                            type="password"
                            value={externalConfig.password}
                            onChange={e => setExternalConfig({...externalConfig, password: e.target.value})}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-purple-400"
                            placeholder="••••••"
                          />
                      </div>
                  </div>

                  <div className="pt-4">
                      <button 
                        onClick={handleExternalConnect}
                        disabled={!!connectingDb || !externalConfig.host || !externalConfig.database}
                        className="w-full py-3.5 bg-purple-600 text-white rounded-xl text-sm font-black shadow-lg shadow-purple-500/30 hover:bg-purple-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                          {connectingDb ? <Loader2 size={16} className="animate-spin" /> : <Server size={16} />}
                          Connect External Database
                      </button>
                  </div>
              </div>
          )}

          {/* Table Preview View */}
          {previewDb && (
              <div className="h-full flex flex-col">
                  <div className="px-2 mb-2">
                      <button 
                        onClick={handleBackToDatabases}
                        className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-purple-600 px-2 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
                      >
                          <ArrowLeft size={14} /> {t('connect.back_btn')}
                      </button>
                  </div>
                  {loadingPreview ? (
                      <div className="flex flex-col items-center justify-center h-32 gap-3 text-gray-400">
                        <Loader2 size={24} className="animate-spin" />
                        <span className="text-xs font-bold uppercase tracking-wider">Fetching Schema...</span>
                      </div>
                  ) : previewTables.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 gap-3 text-gray-400">
                        <Table size={32} className="opacity-20" />
                        <p className="text-sm font-medium">No tables found in this database.</p>
                      </div>
                  ) : (
                      <div className="space-y-1">
                          {previewTables.map(table => (
                              <div key={table} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                                  <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center">
                                      <Table size={16} />
                                  </div>
                                  <span className="text-sm font-medium text-gray-700">{table}</span>
                              </div>
                          ))}
                      </div>
                  )}
                  <div className="mt-auto pt-4 border-t border-gray-100 p-2">
                      <button 
                        onClick={() => handleConnect(previewDb)}
                        className="w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-black shadow-lg shadow-purple-500/30 hover:bg-purple-700 transition-all active:scale-95"
                      >
                          Connect to {previewDb}
                      </button>
                  </div>
              </div>
          )}
        </div>
        
        {/* Loading Overlay with Detailed Status */}
        {(isLoading || connectingDb) && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-10 flex-col gap-6 p-8 text-center animate-in fade-in duration-300">
                 <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center relative shadow-inner">
                    <RefreshCw size={40} className="animate-spin text-purple-600 relative z-10" />
                    <div className="absolute inset-0 animate-ping rounded-full bg-purple-400 opacity-20"></div>
                    <div className="absolute inset-0 animate-pulse rounded-full bg-purple-100 opacity-40 animation-delay-500"></div>
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">
                        {connectionStatus ? t('connect.analyzing') : t('common.loading')}
                    </h3>
                    <p className="text-xs font-bold text-purple-600 mt-3 max-w-xs mx-auto animate-pulse">
                        {connectionStatus || t('connect.establishing')}
                    </p>
                    <p className="text-[10px] font-medium text-gray-400 mt-2 max-w-xs mx-auto">
                        {t('connect.inferring')}
                    </p>
                 </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ConnectDatabaseModal;
