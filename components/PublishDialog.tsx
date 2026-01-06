
import React, { useState, useEffect } from 'react';
import { DevMode, ExecutionResult } from '../types';
import { publishApp, updateApp } from '../services/appService';
import { executePython } from '../services/pythonService';
import { X, Rocket, Sparkles, AlertCircle, CheckCircle2, RefreshCw, ExternalLink, ArrowLeft, Loader2, Code2, Save } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenApp?: (appId: string) => void;
  editingAppId?: string | null; // If present, update this app instead of creating new
  type: DevMode;
  code: string;
  dbName: string | null;
  sourceNotebookId?: string | null;
  resultSnapshot: ExecutionResult | null;
  defaultTitle?: string;
  defaultDescription?: string;
  analysisReport?: string;
  sourcePrompt?: string; 
}

const PublishDialog: React.FC<Props> = ({ 
  isOpen, 
  onClose,
  onOpenApp,
  editingAppId,
  type, 
  code, 
  dbName, 
  sourceNotebookId,
  resultSnapshot,
  defaultTitle,
  defaultDescription,
  analysisReport,
  sourcePrompt
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [paramsJson, setParamsJson] = useState('{}');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDetectingSchema, setIsDetectingSchema] = useState(false);
  const [success, setSuccess] = useState(false);
  const [publishedAppId, setPublishedAppId] = useState<string | null>(null);

  // Auto-fill form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle || '');
      setDescription(defaultDescription || '');
      setSuccess(false);
      setPublishedAppId(null);
      setParamsJson('{}');

      // Auto-detect schema for Python apps
      if (type === DevMode.PYTHON && dbName) {
        detectSchema();
      }
    }
  }, [isOpen, defaultTitle, defaultDescription, type, dbName]);

  const detectSchema = async () => {
    if (!dbName) return;
    setIsDetectingSchema(true);
    
    try {
      // Use shared executePython service with SCHEMA mode
      const result = await executePython(
        code, 
        dbName, 
        {}, 
        'SCHEMA'
      );
      
      if (result.schemaData && Object.keys(result.schemaData).length > 0) {
        setParamsJson(JSON.stringify(result.schemaData, null, 2));
      } else {
        setParamsJson('{}');
      }
    } catch (e) {
      console.error("Schema detection failed", e);
    } finally {
      setIsDetectingSchema(false);
    }
  };

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

      let id;
      if (editingAppId) {
          // Update Mode
          id = await updateApp(
            editingAppId,
            title, 
            description, 
            author, 
            type, 
            code, 
            dbName, 
            sourceNotebookId || undefined, 
            params, 
            resultSnapshot || undefined, 
            analysisReport,
            sourcePrompt
          );
      } else {
          // Create Mode
          id = await publishApp(
            title, 
            description, 
            author, 
            type, 
            code, 
            dbName, 
            sourceNotebookId || undefined, 
            params, 
            resultSnapshot || undefined, 
            analysisReport,
            sourcePrompt
          );
      }
      
      setPublishedAppId(id);
      setSuccess(true);
    } catch (e) {
      alert("Publish/Update failed");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleViewApp = () => {
      if (publishedAppId && onOpenApp) {
          onOpenApp(publishedAppId);
          onClose();
      }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {success ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">
                {editingAppId ? 'Updated Successfully!' : 'Published Successfully!'}
            </h3>
            <p className="text-gray-500 mb-8 max-w-xs mx-auto">Your app is now live in the marketplace and ready to be shared.</p>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button 
                    onClick={onClose}
                    className="flex-1 py-3.5 px-6 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                    <ArrowLeft size={18} />
                    Back to Workbook
                </button>
                <button 
                    onClick={handleViewApp}
                    className={`flex-1 py-3.5 px-6 text-white font-black rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${
                        type === DevMode.SQL 
                            ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' 
                            : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30'
                    }`}
                >
                    View App
                    <ExternalLink size={18} />
                </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl text-white ${type === DevMode.SQL ? 'bg-blue-600' : 'bg-purple-600'}`}>
                  {editingAppId ? <Save size={20} /> : <Rocket size={20} />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 leading-none">{editingAppId ? 'Update App' : 'Publish New App'}</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Share your insight</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"><X size={20}/></button>
            </div>

            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
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
                <div className="space-y-2 bg-purple-50 p-4 rounded-2xl border border-purple-100">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-black text-purple-800 uppercase tracking-wide flex items-center gap-1">
                      <Sparkles size={12} className="text-purple-600" /> 
                      App Parameters
                    </label>
                    {isDetectingSchema ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-purple-500">
                        <Loader2 size={10} className="animate-spin" /> Detecting Inputs...
                      </span>
                    ) : (
                      <button 
                        onClick={detectSchema} 
                        className="text-[10px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                      >
                         <RefreshCw size={10} /> Re-Detect
                      </button>
                    )}
                  </div>
                  
                  {paramsJson === '{}' && !isDetectingSchema ? (
                    <div className="text-xs text-gray-500 italic p-2">
                      No <code className="bg-white px-1 py-0.5 rounded border border-gray-200 text-purple-600 font-mono">SI.params</code> usage detected in your code. The app will be static.
                    </div>
                  ) : (
                    <textarea 
                      value={paramsJson}
                      onChange={e => setParamsJson(e.target.value)}
                      className="w-full px-4 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl font-mono text-xs h-32 resize-none focus:ring-2 focus:ring-purple-500/20 outline-none shadow-sm"
                    />
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                     This JSON Schema defines the sliders and dropdowns users will see.
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
                disabled={isPublishing || !title || isDetectingSchema}
                className={`px-8 py-3 text-white rounded-xl font-black shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${type === DevMode.SQL ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'}`}
               >
                 {isPublishing ? <RefreshCw size={18} className="animate-spin" /> : (editingAppId ? <Save size={18} /> : <Rocket size={18} />)}
                 {editingAppId ? 'Update App' : 'Confirm Publish'}
               </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PublishDialog;
