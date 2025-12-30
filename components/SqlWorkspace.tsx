
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { ExecutionResult, TableMetadata } from '../types';
import BaseCodeEditor, { BaseCodeEditorRef } from './BaseCodeEditor';
import SqlResultPanel from './SqlResultPanel';
import { Database, Play, RefreshCcw, Code2, RotateCcw, Box, Table, Type, Lightbulb, ArrowUp } from 'lucide-react';

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

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'LIMIT', 'GROUP BY', 'ORDER BY', 
  'JOIN', 'LEFT JOIN', 'INNER JOIN', 'RIGHT JOIN', 'FULL JOIN',
  'ON', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AND', 'OR', 'NOT', 
  'NULL', 'IN', 'BETWEEN', 'LIKE', 'HAVING', 'UNION', 'ALL'
];

interface SuggestionItem {
  type: 'keyword' | 'table' | 'column';
  value: string;
  label: string;
  detail?: string;
}

const SqlWorkspace: React.FC<Props> = ({ 
  code, onCodeChange, prompt, onPromptChange, result, previewResult, onRun, isExecuting, 
  isAiGenerating, isAiFixing, onTriggerAi, onDebug, tables, onUndo, showUndo, aiThought 
}) => {
  const editorRef = useRef<BaseCodeEditorRef>(null);
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
            // Enable scrollbar only if content exceeds max height
            textarea.style.overflowY = scrollHeight > 160 ? 'auto' : 'hidden';
        } else {
            // Collapsed state
            textarea.style.height = '44px';
            textarea.scrollTop = 0;
            textarea.style.overflowY = 'hidden';
        }
    }
  }, [prompt, isPromptFocused]);

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Only trigger on Cmd+Enter or Ctrl+Enter to avoid IME conflict
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onTriggerAi();
    }
  };

  // Detect new thought, set unread dot, BUT keep collapsed by default
  useEffect(() => {
    if (aiThought && aiThought !== prevThought.current) {
        setHasUnreadThought(true);
        // Do not auto-open: setShowThought(true); 
        prevThought.current = aiThought;
    }
  }, [aiThought]);

  const handleToggleThought = () => {
      setShowThought(!showThought);
      if (!showThought) {
          setHasUnreadThought(false);
      }
  };

  // Autocomplete State
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 });
  const [matchTerm, setMatchTerm] = useState('');

  // Combine keywords with schema
  const allKeywords = useMemo(() => {
    const items: SuggestionItem[] = [];
    tables.forEach(t => {
      items.push({ type: 'table', value: t.tableName, label: t.tableName, detail: 'Table' });
      t.columns.forEach(c => {
        items.push({ type: 'column', value: c.name, label: c.name, detail: `${t.tableName} (${c.type})` });
      });
    });
    SQL_KEYWORDS.forEach(k => {
      items.push({ type: 'keyword', value: k, label: k });
    });
    return items;
  }, [tables]);

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

  const getCaretCoordinates = () => {
    const textarea = editorRef.current?.textarea;
    if (!textarea) return { top: 0, left: 0 };

    const { selectionStart } = textarea;
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    
    ['fontFamily', 'fontSize', 'fontWeight', 'wordWrap', 'whiteSpace', 'border', 'padding', 'width', 'lineHeight'].forEach(prop => {
      (div.style as any)[prop] = (style as any)[prop];
    });

    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.left = '-9999px';
    div.style.top = '0';
    div.textContent = code.substring(0, selectionStart);

    const span = document.createElement('span');
    span.textContent = '.';
    div.appendChild(span);
    
    document.body.appendChild(div);
    const relativeLeft = span.offsetLeft; 
    const relativeTop = span.offsetTop;
    const scrollTop = textarea.scrollTop;
    const scrollLeft = textarea.scrollLeft;

    document.body.removeChild(div);

    return {
      top: relativeTop - scrollTop + 24, 
      left: relativeLeft - scrollLeft
    };
  };

  const updateSuggestions = (currentCode: string, cursorIndex: number) => {
    if (process.env.SQL_AUTO_COMPLETE === 'false') return;

    let start = cursorIndex;
    while (start > 0 && /[a-zA-Z0-9_\u0080-\uFFFF]/.test(currentCode[start - 1])) {
      start--;
    }
    const currentWord = currentCode.substring(start, cursorIndex);

    if (currentWord.length >= 1) {
      const matches = allKeywords.filter(item => 
        item.label.toLowerCase().startsWith(currentWord.toLowerCase()) && 
        item.label !== currentWord 
      ).slice(0, 8);

      if (matches.length > 0) {
        setMatchTerm(currentWord);
        setSuggestions(matches);
        setHighlightedIndex(0);
        setCursorPosition(getCaretCoordinates());
        setShowSuggestions(true);
        return;
      }
    }
    setShowSuggestions(false);
  };

  const handleCodeChange = (newCode: string) => {
    onCodeChange(newCode);
    setTimeout(() => {
        const textarea = editorRef.current?.textarea;
        if (textarea) {
            updateSuggestions(newCode, textarea.selectionStart);
        }
    }, 0);
  };

  const insertSuggestion = (suggestion: SuggestionItem) => {
    const textarea = editorRef.current?.textarea;
    if (!textarea) return;

    const cursorIndex = textarea.selectionStart;
    const start = cursorIndex - matchTerm.length;
    
    const before = code.substring(0, start);
    const after = code.substring(cursorIndex);
    const toInsert = suggestion.value;

    const newCode = before + toInsert + after;
    onCodeChange(newCode);
    setShowSuggestions(false);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + toInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % suggestions.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(suggestions[highlightedIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }
    if (e.ctrlKey && e.key === ' ') {
      e.preventDefault();
      const textarea = editorRef.current?.textarea;
      if (textarea) {
         updateSuggestions(code, textarea.selectionStart);
      }
    }
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'table': return <Table size={12} className="text-blue-500" />;
      case 'column': return <Type size={12} className="text-green-500" />;
      default: return <Box size={12} className="text-gray-400" />;
    }
  };

  const hasCode = code && code.length > 20 && !code.trim().startsWith("-- Write SQL here");

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
      <div className="px-8 py-4 bg-blue-50/30 border-b border-blue-100/50 flex items-start gap-3">
        <div className="relative group flex-1">
          <textarea
            ref={promptInputRef}
            value={prompt}
            onFocus={() => setIsPromptFocused(true)}
            onBlur={() => setIsPromptFocused(false)}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handlePromptKeyDown}
            placeholder={hasCode ? "Ask AI to modify this SQL... (Cmd+Enter)" : "Ask AI to write SQL... (Cmd+Enter)"}
            rows={1}
            className="w-full pl-10 pr-16 py-2 bg-white border border-blue-100 rounded-xl text-sm focus:outline-none shadow-sm transition-all resize-none overflow-hidden leading-7 text-gray-900 placeholder:text-gray-400"
            style={{ 
                minHeight: '44px',
            }}
          />
          <Database size={16} className="absolute left-3.5 top-3.5 text-blue-400 z-10 pointer-events-none" />
          
          {/* Refined Send Button */}
          <button 
            onClick={onTriggerAi} 
            onMouseDown={(e) => e.preventDefault()}
            disabled={isAiGenerating || isAiFixing || !prompt} 
            className={`absolute right-2 top-2 p-1.5 rounded-lg transition-all flex items-center justify-center z-20 ${
              prompt 
                ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:scale-105' 
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
            title={hasCode ? "Refine SQL" : "Generate SQL"}
          >
            {isAiGenerating || isAiFixing ? (
                <RefreshCcw size={16} className="animate-spin" />
            ) : (
                <ArrowUp size={18} strokeWidth={3} />
            )}
          </button>
        </div>
        
        {/* Lightbulb Toggle Button */}
        {aiThought && (
            <button
                onClick={handleToggleThought}
                className={`p-2.5 rounded-xl border transition-all relative top-0.5 ${showThought ? 'bg-yellow-100 border-yellow-200 text-yellow-700' : 'bg-white border-blue-100 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'}`}
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
                            <Lightbulb size={18} />
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
              className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-blue-200 text-blue-600 rounded-lg text-[10px] font-black shadow-xl hover:bg-blue-50 transition-all active:scale-95"
            >
              <RotateCcw size={12} /> Revert AI Change
            </button>
          </div>
        )}
        
        <BaseCodeEditor 
          ref={editorRef} 
          code={code} 
          onChange={handleCodeChange} 
          onKeyDown={handleKeyDown} 
          language="sql" 
          placeholder="-- Write SQL here..." 
          readOnly={isAiGenerating || isAiFixing} 
        />

        {showSuggestions && (
          <div 
            className="absolute z-[100] bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden min-w-[200px] max-w-[300px] animate-in fade-in zoom-in-95 duration-75"
            style={{ 
              top: cursorPosition.top, 
              left: cursorPosition.left 
            }}
          >
            <div className="text-[9px] font-black uppercase tracking-widest bg-gray-50 px-3 py-1.5 text-gray-400 border-b border-gray-100 flex justify-between">
              <span>Suggestions</span>
              <span className="text-[8px] bg-gray-200 px-1 rounded text-gray-500">TAB</span>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {suggestions.map((item, idx) => (
                <div
                  key={`${item.value}-${idx}`}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-mono border-l-2 transition-colors ${
                    idx === highlightedIndex 
                      ? 'bg-blue-50 border-blue-500 text-blue-700' 
                      : 'bg-white border-transparent text-gray-600 hover:bg-gray-50'
                  }`}
                  onClick={() => insertSuggestion(item)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  {renderIcon(item.type)}
                  <div className="flex flex-col truncate">
                    <span className="font-bold truncate">{item.label}</span>
                    {item.detail && <span className="text-[9px] text-gray-400 font-sans truncate">{item.detail}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="px-6 py-3 border-t border-gray-100 bg-white flex justify-between items-center shrink-0 z-10">
          <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1.5"><Code2 size={12} className="text-blue-400" /><span>ANSI SQL</span></div>
          </div>
          <button onClick={onRun} disabled={isExecuting || isAiGenerating || isAiFixing} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">
            {isExecuting ? <RefreshCcw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />} Execute Query
          </button>
        </div>
      </div>

      <SqlResultPanel 
        result={result} 
        previewResult={previewResult} 
        isLoading={isExecuting} 
        onDebug={onDebug} 
        isAiLoading={isAiFixing} 
      />
    </div>
  );
};

export default SqlWorkspace;
