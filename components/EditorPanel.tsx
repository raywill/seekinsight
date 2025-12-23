
import React, { useState } from 'react';
import { DevMode, TableMetadata } from '../types';
import { Play, Sparkles, Code2, Terminal, RefreshCcw } from 'lucide-react';
import * as ai from '../services/aiProvider';

interface Props {
  mode: DevMode;
  code: string;
  onCodeChange: (code: string) => void;
  onRun: () => void;
  isExecuting: boolean;
  tables: TableMetadata[];
}

const EditorPanel: React.FC<Props> = ({ mode, code, onCodeChange, onRun, isExecuting, tables }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const generated = await ai.generateCode(prompt, mode, tables);
      onCodeChange(generated);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "AI failed to generate code.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* AI Prompt Bar */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="relative group">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
            placeholder={mode === DevMode.SQL ? "e.g., Calculate monthly revenue by region..." : "e.g., Create a forecast plot using pandas..."}
            className={`w-full pl-10 pr-24 py-2.5 bg-white border ${error ? 'border-red-300' : 'border-gray-200'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all`}
          />
          <Sparkles size={16} className={`absolute left-3.5 top-3.5 ${error ? 'text-red-400' : 'text-blue-500'}`} />
          <button
            onClick={handleAiGenerate}
            disabled={isGenerating || !prompt}
            className="absolute right-2 top-2 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 transition-all"
          >
            {isGenerating ? <RefreshCcw size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Ask AI
          </button>
        </div>
        {error && <p className="mt-2 text-[10px] font-bold text-red-500 ml-2">{error}</p>}
      </div>

      <div className="flex-1 relative font-mono text-sm group">
        <textarea
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          className="w-full h-full p-6 focus:outline-none resize-none bg-white text-gray-800 leading-relaxed"
          spellCheck={false}
        />
        <div className="absolute top-4 right-6 px-2 py-1 bg-gray-100 text-gray-500 rounded text-[10px] uppercase font-bold tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
          {mode} Mode
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-100 bg-white flex justify-between items-center">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1"><Code2 size={12} /><span>UTF-8</span></div>
          <div className="flex items-center gap-1"><Terminal size={12} /><span>Session Active</span></div>
        </div>
        <button
          onClick={onRun}
          disabled={isExecuting}
          className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-black disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-gray-200"
        >
          {isExecuting ? <RefreshCcw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
          Run Script
        </button>
      </div>
    </div>
  );
};

export default EditorPanel;
