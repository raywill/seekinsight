import React, { useState, useEffect, useRef } from 'react';
import { ExecutionResult, TableMetadata } from '../types';
import BaseCodeEditor from './BaseCodeEditor';
import PythonResultPanel from './PythonResultPanel';
import { Terminal, Play, Sparkles, RefreshCcw, Box, RotateCcw, Lightbulb, ChevronDown, ChevronRight } from 'lucide-react';

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
  aiThought?: string | null; // New Prop
}

const PythonWorkspace: React.FC<Props> = ({ 
  code, onCodeChange, prompt, onPromptChange, result, onRun, isExecuting, 
  isAiGenerating, isAiFixing, onTriggerAi, onDebug, tables, onUndo, showUndo, aiThought
}) => {
  const [isUndoVisible, setIsUndoVisible] = useState(false);
  const prevLoading = useRef(isAiGenerating || isAiFixing);

  // Thought State
  const [showThought, setShowThought] = useState(false);
  const prevThought = useRef(aiThought);

  // Auto-expand thought when it changes
  useEffect(() => {
    if (aiThought && aiThought !== prevThought.current) {
        setShowThought(true);
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
      <div className="px-8 py-4 bg-purple-50/30 border-b border-purple-100/50">
        <div className="relative group w-full">
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
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* CoT Panel */}
        {aiThought && (
            <div className={`transition-all duration-300 ease-in-out border-b border-yellow-100 bg-yellow-50 overflow-hidden flex flex-col ${showThought ? 'max-h-[300px]' : 'max-h-[40px] hover:bg-yellow-100/50 cursor-pointer'}`}>
                <div 
                    className="flex items-center justify-between px-6 py-2 shrink-0 cursor-pointer"
                    onClick={() => setShowThought(!showThought)}
                >
                    <div className="flex items-center gap-2">
                        <div className="p-1 bg-yellow-200 rounded text-yellow-700">
                            <Lightbulb size={12} fill="currentColor" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-700">AI Reasoning Chain</span>
                    </div>
                    {showThought ? <ChevronDown size={14} className="text-yellow-400"/> : <ChevronRight size={14} className="text-yellow-400"/>}
                </div>
                <div className={`px-8 pb-4 overflow-y-auto ${showThought ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="text-xs text-yellow-900/80 font-medium leading-relaxed whitespace-pre-wrap font-mono">
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
