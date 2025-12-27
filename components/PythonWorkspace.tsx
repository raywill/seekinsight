
import React, { useState, useEffect, useRef } from 'react';
import { ExecutionResult, TableMetadata } from '../types';
import BaseCodeEditor from './BaseCodeEditor';
import PythonResultPanel from './PythonResultPanel';
import { Terminal, Play, Sparkles, RefreshCcw, Box, RotateCcw, Lightbulb, X } from 'lucide-react';

interface Props {
  code: string;
  onCodeChange: (val: string) => void;
  prompt: string;
  onPromptChange: (val: string) => void;
  result: ExecutionResult | null;
  onRun: () => void;
  isExecuting: boolean;
  isAiGenerating: boolean;
  isAiFixing: boolean;
  onTriggerAi: () => void;
  onDebug: () => void;
  tables: TableMetadata[];
  onUndo?: () => void;
  showUndo?: boolean;
  aiThought?: string | null;
}

const PythonWorkspace: React.FC<Props> = ({ 
  code, onCodeChange, prompt, onPromptChange, result, onRun, isExecuting, 
  isAiGenerating, isAiFixing, onTriggerAi, onDebug, tables, onUndo, showUndo, aiThought
}) => {
  const [isUndoVisible, setIsUndoVisible] = useState(false);
  const prevLoading = useRef(isAiGenerating || isAiFixing);

  // Thought State
  const [showThought, setShowThought] = useState(false);
  const [hasUnreadThought, setHasUnreadThought] = useState(false);
  const prevThought = useRef(aiThought);

  useEffect(() => {
    if (aiThought && aiThought !== prevThought.current) {
        setShowThought(true);
        setHasUnreadThought(true);
        prevThought.current = aiThought;
    }
  }, [aiThought]);

  useEffect(() => {
    if (prevLoading.current && !(isAiGenerating || isAiFixing) && showUndo) {
      setIsUndoVisible(true);
      const timer = setTimeout(() => setIsUndoVisible(false), 10000);
      return () => clearTimeout(timer);
    }
    if (isAiGenerating || isAiFixing || !showUndo) {
      setIsUndoVisible(false);
    }
    prevLoading.current = isAiGenerating || isAiFixing;
  }, [isAiGenerating, isAiFixing, showUndo]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="px-8 py-4 bg-purple-50/30 border-b border-purple-100/50 flex items-center gap-3">
        <div className="relative group flex-1">
          <input
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Ask AI for a Python script... e.g. Analyze correlation between age and price"
            className="w-full pl-10 pr-40 py-2.5 bg-white border border-purple-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/5 shadow-sm transition-all"
          />
          <Terminal size={16} className="absolute left-3.5 top-3.5 text-purple-400" />
          <button 
            onClick={onTriggerAi} 
            disabled={isAiGenerating || isAiFixing || !prompt} 
            className="absolute right-2 top-2 px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {isAiGenerating ? <RefreshCcw size={12} className="animate-spin" /> : <Sparkles size={12} />} 
            Script with AI
          </button>
        </div>
        {aiThought && (
            <button
                onClick={() => { setShowThought(!showThought); setHasUnreadThought(false); }}
                className={`p-2.5 rounded-xl border transition-all relative ${showThought ? 'bg-yellow-100 border-yellow-200 text-yellow-700' : 'bg-white border-purple-100 text-gray-400 hover:text-yellow-600'}`}
                title="View AI Reasoning"
            >
                <Lightbulb size={18} fill={showThought ? "currentColor" : "none"} />
                {!showThought && hasUnreadThought && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
            </button>
        )}
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Floating CoT Panel */}
        {aiThought && showThought && (
            <div className="absolute top-4 right-6 z-30 w-96 max-h-[400px] flex flex-col bg-white/95 backdrop-blur-md border border-yellow-200 shadow-2xl rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="px-4 py-3 border-b border-yellow-100 flex items-center justify-between bg-yellow-50/50 rounded-t-2xl">
                    <div className="flex items-center gap-2 text-yellow-700">
                        <Sparkles size={14} />
                        <span className="text-xs font-black uppercase tracking-widest">AI Reasoning</span>
                    </div>
                    <button onClick={() => setShowThought(false)} className="text-yellow-700/50 hover:text-yellow-700">
                        <X size={14} />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto custom-scrollbar">
                    <div className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap font-mono">
                        {aiThought}
                    </div>
                </div>
            </div>
        )}

        {isUndoVisible && (
          <div className="absolute top-4 right-6 z-20 animate-in fade-in slide-in-from-top-2 duration-300">
            <button 
              onClick={() => { onUndo?.(); setIsUndoVisible(false); }} 
              className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-purple-200 text-purple-600 rounded-lg text-[10px] font-black shadow-xl hover:bg-purple-50 transition-all active:scale-95"
            >
              <RotateCcw size={12} /> Revert AI Change
            </button>
          </div>
        )}

        <BaseCodeEditor code={code} onChange={onCodeChange} language="python" placeholder="# Write Python here..." readOnly={isAiGenerating || isAiFixing} />
        
        <div className="px-6 py-3 border-t border-gray-100 bg-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1.5"><Box size={12} className="text-purple-400" /><span>Python 3.10</span></div>
          </div>
          <button onClick={onRun} disabled={isExecuting || isAiGenerating || isAiFixing} className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-black shadow-lg hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-50">
            {isExecuting ? <RefreshCcw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />} Run Analysis
          </button>
        </div>
      </div>

      <PythonResultPanel result={result} isLoading={isExecuting} onDebug={onDebug} isAiLoading={isAiFixing} />
    </div>
  );
};

export default PythonWorkspace;
