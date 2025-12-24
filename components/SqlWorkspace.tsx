
import React, { useState } from 'react';
import { ExecutionResult, TableMetadata, DevMode } from '../types';
import BaseCodeEditor from './BaseCodeEditor';
import ResultPanel from './ResultPanel';
import { Database, Play, Sparkles, RefreshCcw, Code2 } from 'lucide-react';
import * as ai from '../services/aiProvider';

interface Props {
  code: string;
  onCodeChange: (val: string) => void;
  prompt: string;
  onPromptChange: (val: string) => void;
  result: ExecutionResult | null;
  onRun: () => void;
  isExecuting: boolean;
  tables: TableMetadata[];
}

const SqlWorkspace: React.FC<Props> = ({ 
  code, onCodeChange, prompt, onPromptChange, result, onRun, isExecuting, tables 
}) => {
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiAsk = async () => {
    if (!prompt.trim()) return;
    setIsAiLoading(true);
    try {
      const generated = await ai.generateCode(prompt, DevMode.SQL, tables);
      onCodeChange(generated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="p-4 bg-blue-50/30 border-b border-blue-100/50">
        <div className="relative group max-w-5xl mx-auto">
          <input
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Ask AI to write SQL... e.g. Find top 10 customers by revenue"
            className="w-full pl-10 pr-24 py-2.5 bg-white border border-blue-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-sm transition-all font-medium"
          />
          <Database size={16} className="absolute left-3.5 top-3.5 text-blue-400" />
          <button
            onClick={handleAiAsk}
            disabled={isAiLoading || !prompt}
            className="absolute right-2 top-2 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 transition-all"
          >
            {isAiLoading ? <RefreshCcw size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generate SQL
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <BaseCodeEditor 
          code={code} 
          onChange={onCodeChange} 
          language="sql" 
          placeholder="-- Write your SQL here..." 
        />
        
        <div className="px-6 py-3 border-t border-gray-100 bg-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1.5"><Code2 size={12} className="text-blue-400" /><span>ANSI SQL</span></div>
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div><span>Connected</span></div>
          </div>
          <button
            onClick={onRun}
            disabled={isExecuting}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-blue-100"
          >
            {isExecuting ? <RefreshCcw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
            Execute Query
          </button>
        </div>
      </div>

      <ResultPanel mode={DevMode.SQL} result={result} isLoading={isExecuting} />
    </div>
  );
};

export default SqlWorkspace;
