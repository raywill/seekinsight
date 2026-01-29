
import React, { useState, useEffect } from 'react';
import { X, Database, Search, Loader2, Link as LinkIcon, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (dbName: string) => Promise<void>;
  isLoading?: boolean;
}

const ConnectDatabaseModal: React.FC<Props> = ({ isOpen, onClose, onConnect, isLoading }) => {
  const [databases, setDatabases] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState('');
  const [connectingDb, setConnectingDb] = useState<string | null>(null);

  const gatewayUrl = (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';

  useEffect(() => {
    if (isOpen) {
      fetchDatabases();
    }
  }, [isOpen]);

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

  const filteredDbs = databases.filter(db => db.toLowerCase().includes(search.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!isLoading && !connectingDb ? onClose : undefined}></div>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600 rounded-xl text-white shadow-lg shadow-purple-500/20">
              <LinkIcon size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 leading-none">Connect Database</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Switch Context & Enrich Metadata</p>
            </div>
          </div>
          {!isLoading && !connectingDb && (
             <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"><X size={20}/></button>
          )}
        </div>

        <div className="p-4 border-b border-gray-100">
            <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                <input 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search databases..."
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 bg-white">
          {fetching ? (
             <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-xs font-bold uppercase tracking-wider">Scanning Cluster...</span>
             </div>
          ) : filteredDbs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
              <Database size={32} className="opacity-20" />
              <p className="text-sm font-medium">No databases found.</p>
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
                  
                  <button 
                    onClick={() => handleConnect(db)}
                    disabled={!!connectingDb}
                    className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg shadow-sm group-hover:border-purple-200 group-hover:text-purple-600 hover:bg-purple-600 hover:!text-white transition-all disabled:opacity-50"
                  >
                    {connectingDb === db ? <Loader2 size={14} className="animate-spin" /> : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {(isLoading || connectingDb) && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-10 flex-col gap-4 p-8 text-center">
                 <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center relative">
                    <RefreshCw size={32} className="animate-spin text-purple-600" />
                    <div className="absolute inset-0 animate-ping rounded-full bg-purple-400 opacity-20"></div>
                 </div>
                 <div>
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest">Enriching Schema</h3>
                    <p className="text-xs font-medium text-gray-500 mt-2 max-w-xs mx-auto">
                        AI is analyzing table semantics and generating column comments for up to 10 tables...
                    </p>
                 </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ConnectDatabaseModal;
