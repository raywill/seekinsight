
import React from 'react';
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
        {showUndo && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <button onClick={onUndo} className="flex items-center gap-2 px-4 py-1.5 bg-white border border-purple-200 text-purple-600 rounded-full text-xs font-black shadow-xl">
              <RotateCcw size={14} /> Revert Suggestion
            </button>
          </div>
        )}

        <BaseCodeEditor code={code} onChange={onCodeChange} language="python" placeholder="# Write Python here..." />
        
        <div className="px-6 py-3 border-t border-gray-100 bg-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1.5"><Box size={12} className="text-purple-400" /><span>Python 3.10</span></div>
          </div>
          <button onClick={onRun} disabled={isExecuting} className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-black shadow-lg">
            {isExecuting ? <RefreshCcw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />} Run Analysis
          </button>
        </div>
      </div>

      <PythonResultPanel result={result} isLoading={isExecuting} />
    </div>
  );
};

export default PythonWorkspace;
