
import React, { useState, useEffect, useRef } from 'react';
import { ExecutionResult, TableMetadata } from '../types';
import BaseCodeEditor from './BaseCodeEditor';
import PythonResultPanel from './PythonResultPanel';
import { Terminal, Play, Sparkles, RefreshCcw, Box, RotateCcw } from 'lucide-react';

interface Props {
  code: string;
  onCodeChange: (val: string) => void;
  prompt: string;
  onPromptChange: (val: string) => void;
  result: ExecutionResult | null;
  onRun: () => void;
  isExecuting: boolean;
  isAiLoading: boolean;
  onTriggerAi: () => void;
  tables: TableMetadata[];
  onUndo?: () => void;
  showUndo?: boolean;
}

const PythonWorkspace: React.FC<Props> = ({ 
  code, onCodeChange, prompt, onPromptChange, result, onRun, isExecuting, isAiLoading, onTriggerAi, tables, onUndo, showUndo 
}) => {
  const [isUndoVisible, setIsUndoVisible] = useState(false);
  const prevLoading = useRef(isAiLoading);

  useEffect(() => {
    if (prevLoading.current && !isAiLoading && showUndo) {
      setIsUndoVisible(true);
      const timer = setTimeout(() => setIsUndoVisible(false), 10000);
      return () => clearTimeout(timer);
    }
    if (isAiLoading || !showUndo) {
      setIsUndoVisible(false);
    }
    prevLoading.current = isAiLoading;
  }, [isAiLoading, showUndo]);

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
            disabled={isAiLoading || !prompt} 
            className="absolute right-2 top-2 px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {isAiLoading ? <RefreshCcw size={12} className="animate-spin" /> : <Sparkles size={12} />} 
            Script with AI
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
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

        <BaseCodeEditor code={code} onChange={onCodeChange} language="python" placeholder="# Write Python here..." />
        
        <div className="px-6 py-3 border-t border-gray-100 bg-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1.5"><Box size={12} className="text-purple-400" /><span>Python 3.10</span></div>
          </div>
          <button onClick={onRun} disabled={isExecuting} className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-black shadow-lg hover:bg-purple-700 active:scale-95 transition-all">
            {isExecuting ? <RefreshCcw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />} Run Analysis
          </button>
        </div>
      </div>

      <PythonResultPanel result={result} isLoading={isExecuting} />
    </div>
  );
};

export default PythonWorkspace;
