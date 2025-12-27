
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { ExecutionResult, TableMetadata } from '../types';
import BaseCodeEditor, { BaseCodeEditorRef } from './BaseCodeEditor';
import SqlResultPanel from './SqlResultPanel';
import { Database, Play, Sparkles, RefreshCcw, Code2, RotateCcw, Box, Table, Type, Lightbulb, X } from 'lucide-react';

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
  code, onCodeChange, prompt, onPromptChange, result, onRun, isExecuting, 
  isAiGenerating, isAiFixing, onTriggerAi, onDebug, tables, onUndo, showUndo, aiThought 
}) => {
  const editorRef = useRef<BaseCodeEditorRef>(null);
  const [isUndoVisible, setIsUndoVisible] = useState(false);
  const prevLoading = useRef(isAiGenerating || isAiFixing);
  
  // Thought State
  const [showThought, setShowThought] = useState(false);
  const [hasUnreadThought, setHasUnreadThought] = useState(false);
  const prevThought = useRef(aiThought);

  // Auto-trigger unread dot, but don't auto-open unless user wants (or we can just auto-open gently)
  // Let's auto-open gently if it's new
  useEffect(() => {
    if (aiThought && aiThought !== prevThought.current) {
        setShowThought(true);
        setHasUnreadThought(true);
        prevThought.current = aiThought;
    }
  }, [aiThought]);

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
      <div className="px-8 py-4 bg-blue-50/30 border-b border-blue-100/50 flex items-center gap-3">
        <div className="relative group flex-1">
          <input
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Ask AI to write SQL... e.g. Show revenue trends by segment"
            className="w-full pl-10 pr-40 py-2.5 bg-white border border-blue-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-sm transition-all"
          />
          <Database size={16} className="absolute left-3.5 top-3.5 text-blue-400" />
          <button 
            onClick={onTriggerAi} 
            disabled={isAiGenerating || isAiFixing || !prompt} 
            className="absolute right-2 top-2 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isAiGenerating ? <RefreshCcw size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generate SQL
          </button>
        </div>
        {aiThought && (
            <button
                onClick={() => { setShowThought(!showThought); setHasUnreadThought(false); }}
                className={`p-2.5 rounded-xl border transition-all relative ${showThought ? 'bg-yellow-100 border-yellow-200 text-yellow-700' : 'bg-white border-blue-100 text-gray-400 hover:text-yellow-600'}`}
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

      <SqlResultPanel result={result} isLoading={isExecuting} onDebug={onDebug} isAiLoading={isAiFixing} />
    </div>
  );
};

export default SqlWorkspace;
