
import React, { useState, useEffect } from 'react';
import { DevMode, ExecutionResult } from '../types';
import { publishApp } from '../services/appService';
import { X, Rocket, Sparkles, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: DevMode;
  code: string;
  dbName: string | null;
  resultSnapshot: ExecutionResult | null;
  defaultTitle?: string;
  defaultDescription?: string;
  analysisReport?: string;
}

const PublishDialog: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  type, 
  code, 
  dbName, 
  resultSnapshot,
  defaultTitle,
  defaultDescription,
  analysisReport
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [paramsJson, setParamsJson] = useState('{\n  "threshold": 0.5,\n  "region": "Global"\n}');
  const [isPublishing, setIsPublishing] = useState(false);
  const [success, setSuccess] = useState(false);

  // Auto-fill form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle || '');
      setDescription(defaultDescription || '');
      setSuccess(false); // Reset success state
    }
  }, [isOpen, defaultTitle, defaultDescription]);

  if (!isOpen) return null;

  const handlePublish = async () => {
    if (!dbName || !title) return;
    setIsPublishing(true);
    try {
      let params = null;
      if (type === DevMode.PYTHON) {
        try {
          params = JSON.parse(paramsJson);
        } catch (e) {
          alert("Invalid JSON for Parameters");
          setIsPublishing(false);
          return;
        }
      }

      await publishApp(title, description, author, type, code, dbName, params, resultSnapshot || undefined, analysisReport);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setTitle('');
        setDescription('');
      }, 2000);
    } catch (e) {
      alert("Publish failed");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {success ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Published Successfully!</h3>
            <p className="text-gray-500">Your app is now live in the marketplace.</p>
          </div>
        ) : (
          <>
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl text-white ${type === DevMode.SQL ? 'bg-blue-600' : 'bg-purple-600'}`}>
                  <Rocket size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 leading-none">Publish {type === DevMode.SQL ? 'Dashboard' : 'Script'}</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Share your insight</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"><X size={20}/></button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 uppercase tracking-wide">App Title</label>
                <input 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Q3 Sales Forecast Model"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-bold text-gray-800"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 uppercase tracking-wide">Description</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What does this app do?"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm h-24 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 uppercase tracking-wide">Author Name (Optional)</label>
                <input 
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  placeholder="e.g., Data Team"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm"
                />
              </div>

              {type === DevMode.PYTHON && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-gray-700 uppercase tracking-wide flex items-center gap-1">
                      <Sparkles size={12} className="text-purple-500" /> Default Parameters (JSON)
                    </label>
                  </div>
                  <textarea 
                    value={paramsJson}
                    onChange={e => setParamsJson(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 text-gray-100 border border-gray-800 rounded-xl font-mono text-xs h-32 resize-none focus:ring-2 focus:ring-purple-500/20 outline-none"
                  />
                  <p className="text-[10px] text-gray-400">
                    Use <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600">SI_PARAMS</code> in your Python code to access these values.
                  </p>
                </div>
              )}

              {!resultSnapshot && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold">
                  <AlertCircle size={16} />
                  Warning: No execution result available for snapshot.
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
               <button onClick={onClose} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
               <button 
                onClick={handlePublish}
                disabled={isPublishing || !title}
                className={`px-8 py-3 text-white rounded-xl font-black shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${type === DevMode.SQL ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'}`}
               >
                 {isPublishing ? <RefreshCw size={18} className="animate-spin" /> : <Rocket size={18} />}
                 Confirm Publish
               </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PublishDialog;
