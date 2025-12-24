
import React, { useState, useEffect } from 'react';
import { ExecutionResult, TableMetadata, DevMode } from '../types';
import BaseCodeEditor from './BaseCodeEditor';
import ResultPanel from './ResultPanel';
import { Terminal, Play, Sparkles, RefreshCcw, Box, RotateCcw } from 'lucide-react';
import * as ai from '../services/aiProvider';

interface Props {
  code: string;
  onCodeChange: (val: string) => void;
  prompt: string;
  onPromptChange: (val: string) => void;
  promptId?: string | null;
  result: ExecutionResult | null;
  onRun: () => void;
  isExecuting: boolean;
  tables: TableMetadata[];
  onUndo?: () => void;
  showUndo?: boolean;
}

const PythonWorkspace: React.FC<Props> = ({ 
  code, onCodeChange, prompt, onPromptChange, promptId, result, onRun, isExecuting, tables, onUndo, showUndo 
}) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);

  const handleAiAsk = async () => {
    if (!prompt.trim()) return;
    setIsAiLoading(true);
    try {
      const generated = await ai.generateCode(prompt, DevMode.PYTHON, tables);
      onCodeChange(generated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Logic 1: Auto-trigger AI on unique promptId (Force Apply)
  useEffect(() => {
    if (promptId) {
      handleAiAsk();
    }
  }, [promptId]);

  // Logic 2: Smart Auto-Hide for Revert Suggestion Button
  useEffect(() => {
    if (showUndo) {
      setUndoVisible(true);
      const timer = setTimeout(() => {
        setUndoVisible(false);
      }, 10000); // Hide after 10 seconds
      return () => clearTimeout(timer);
    } else {
      setUndoVisible(false);
    }
  }, [showUndo]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="p-4 bg-purple-50/30 border-b border-purple-100/50">
        <div className="relative group max-w-5xl mx-auto">
          <input
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Ask AI for a Python script... e.g. Plot correlation between age and revenue"
            className="w-full pl-10 pr-24 py-2.5 bg-white border border-purple-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/5 shadow-sm transition-all font-medium"
          />
          <Terminal size={16} className="absolute left-3.5 top-3.5 text-purple-400" />
          <button
            onClick={handleAiAsk}
            disabled={isAiLoading || !prompt}
            className="absolute right-2 top-2 px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5 transition-all"
          >
            {isAiLoading ? <RefreshCcw size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Script with AI
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        {undoVisible && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-in slide-in-from-top duration-300">
            <button 
              onClick={() => {
                if (onUndo) onUndo();
                setUndoVisible(false);
              }}
              className="flex items-center gap-2 px-4 py-1.5 bg-white border border-purple-200 text-purple-600 rounded-full text-xs font-black shadow-xl hover:bg-purple-50 transition-all border-b-2 active:translate-y-0.5"
            >
              <RotateCcw size={14} />
              Revert Suggestion
            </button>
          </div>
        )}

        <BaseCodeEditor 
          code={code} 
          onChange={onCodeChange} 
          language="python" 
          placeholder="# Write your Python data analysis here..." 
        />
        
        <div className="px-6 py-3 border-t border-gray-100 bg-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1.5"><Box size={12} className="text-purple-400" /><span>Python 3.10</span></div>
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div><span>Environment Ready</span></div>
          </div>
          <button
            onClick={onRun}
            disabled={isExecuting}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-black hover:bg-purple-700 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-purple-100"
          >
            {isExecuting ? <RefreshCcw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
            Run Analysis
          </button>
        </div>
      </div>

      <ResultPanel mode={DevMode.PYTHON} result={result} isLoading={isExecuting} />
    </div>
  );
};

export default PythonWorkspace;
