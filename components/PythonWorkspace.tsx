
import React, { useState, useEffect, useRef } from 'react';
import { ExecutionResult, TableMetadata } from '../types';
import BaseCodeEditor from './BaseCodeEditor';
import PythonResultPanel from './PythonResultPanel';
import { Terminal, Play, Sparkles, RefreshCcw, Box, RotateCcw, Lightbulb } from 'lucide-react';

interface Props {
  code: string;
  onCodeChange: (val: string) => void;
  prompt: string;
  onPromptChange: (val: string) => void;
  result: ExecutionResult | null;
  previewResult?: ExecutionResult | null; // Receive preview result
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
  code, onCodeChange, prompt, onPromptChange, result, previewResult, onRun, isExecuting, 
  isAiGenerating, isAiFixing, onTriggerAi, onDebug, tables, onUndo, showUndo, aiThought
}) => {
  const [isUndoVisible, setIsUndoVisible] = useState(false);
  const prevLoading = useRef(isAiGenerating || isAiFixing);

  // Thought State
  const [showThought, setShowThought] = useState(false);
  const [hasUnreadThought, setHasUnreadThought] = useState(false);
  const prevThought = useRef(aiThought);

  // Prompt Input State
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize Logic for Prompt Input
  useEffect(() => {
    const textarea = promptInputRef.current;
    if (textarea) {
        // Reset to auto to correctly calculate scrollHeight for shrinking
        textarea.style.height = 'auto';
        
        if (isPromptFocused) {
            const scrollHeight = textarea.scrollHeight;
            // Min height 44px (match py-2 + leading-7), Max height 160px
            const newHeight = Math.min(Math.max(scrollHeight, 44), 160);
            textarea.style.height = `${newHeight}px`;
        } else {
            // Collapsed state
            textarea.style.height = '44px';
            textarea.scrollTop = 0;
        }
    }
  }, [prompt, isPromptFocused]);

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onTriggerAi();
    }
  };

  useEffect(() => {
    if (aiThought && aiThought !== prevThought.current) {
        setHasUnreadThought(true);
        // Do not auto-open
        prevThought.current = aiThought;
    }
  }, [aiThought]);

  const handleToggleThought = () => {
      setShowThought(!showThought);
      if (!showThought) {
          setHasUnreadThought(false);
      }
  };

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
      <div className="px-8 py-4 bg-purple-50/30 border-b border-purple-100/50 flex items-start gap-3">
        <div className="relative group flex-1">
          <textarea
            ref={promptInputRef}
            value={prompt}
            onFocus={() => setIsPromptFocused(true)}
            onBlur={() => setIsPromptFocused(false)}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handlePromptKeyDown}
            placeholder="Ask AI for a Python script... e.g. Analyze correlation between age and price"
            rows={1}
            className="w-full pl-10 pr-40 py-2 bg-white border border-purple-100 rounded-xl text-sm focus:outline-none shadow-sm transition-all resize-none overflow-hidden leading-7 text-gray-900"
            style={{ 
                minHeight: '44px',
            }}
          />
          <Terminal size={16} className="absolute left-3.5 top-3.5 text-purple-400 z-10 pointer-events-none" />
          <button 
            onClick={onTriggerAi} 
            // Prevent default on mousedown to avoid blurring the textarea instantly when clicking
            onMouseDown={(e) => e.preventDefault()}
            disabled={isAiGenerating || isAiFixing || !prompt} 
            className="absolute right-2 top-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap hover:bg-purple-700 transition-colors disabled:opacity-50 z-20"
          >
            {isAiGenerating ? <RefreshCcw size={12} className="animate-spin" /> : <Sparkles size={12} />} 
            Script with AI
          </button>
        </div>

        {/* Lightbulb Toggle Button */}
        {aiThought && (
            <button
                onClick={handleToggleThought}
                className={`p-2.5 rounded-xl border transition-all relative top-0.5 ${showThought ? 'bg-yellow-100 border-yellow-200 text-yellow-700' : 'bg-white border-purple-100 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'}`}
                title="Toggle AI Reasoning"
            >
                <Lightbulb size={18} fill={showThought ? "currentColor" : "none"} />
                {!showThought && hasUnreadThought && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
            </button>
        )}
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Full-height CoT Panel Overlay */}
        <div 
            className={`absolute inset-0 z-30 bg-[#fffdf5] flex flex-col transition-all duration-300 ease-out ${showThought ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
        >
            <div className="flex-1 overflow-y-auto px-10 py-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-yellow-100">
                        <div className="p-2 bg-yellow-100 rounded-lg text-yellow-700">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-yellow-800 uppercase tracking-widest">AI Reasoning Chain</h3>
                            <p className="text-[10px] text-yellow-600 font-bold">Step-by-step logic behind the generated code</p>
                        </div>
                    </div>
                    <div className="text-xs text-yellow-900/80 font-medium leading-relaxed whitespace-pre-wrap font-mono">
                        {aiThought}
                    </div>
                </div>
            </div>
        </div>

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

      <PythonResultPanel 
        result={result} 
        previewResult={previewResult} 
        isLoading={isExecuting} 
        onDebug={onDebug} 
        isAiLoading={isAiFixing} 
      />
    </div>
  );
};

export default PythonWorkspace;
