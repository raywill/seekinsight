
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { ExecutionResult, TableMetadata } from '../types';
import BaseCodeEditor, { BaseCodeEditorRef } from './BaseCodeEditor';
import SqlResultPanel from './SqlResultPanel';
import { Database, Play, Sparkles, RefreshCcw, Code2, RotateCcw, Box, Table, Type } from 'lucide-react';

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
  isAiGenerating, isAiFixing, onTriggerAi, onDebug, tables, onUndo, showUndo 
}) => {
  const editorRef = useRef<BaseCodeEditorRef>(null);
  const [isUndoVisible, setIsUndoVisible] = useState(false);
  const prevLoading = useRef(isAiGenerating || isAiFixing);

  // Autocomplete State
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 });
  const [matchTerm, setMatchTerm] = useState('');

  // Combine keywords with schema
  const allKeywords = useMemo(() => {
    const items: SuggestionItem[] = [];
    
    // 1. Tables
    tables.forEach(t => {
      items.push({ type: 'table', value: t.tableName, label: t.tableName, detail: 'Table' });
      // 2. Columns
      t.columns.forEach(c => {
        items.push({ type: 'column', value: c.name, label: c.name, detail: `${t.tableName} (${c.type})` });
      });
    });

    // 3. SQL Keywords
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
    
    // Create a mirror div to calculate position
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    
    // Copy essential styles
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
    
    // Adjust for the specific padding of the editor (matches CSS in index.html)
    // padding: 20px 20px 20px 65px !important;
    // We need relative position inside the textarea container
    const relativeLeft = span.offsetLeft; 
    const relativeTop = span.offsetTop;
    
    // Adjust for scroll
    const scrollTop = textarea.scrollTop;
    const scrollLeft = textarea.scrollLeft;

    document.body.removeChild(div);

    return {
      top: relativeTop - scrollTop + 24, // + Line Height roughly
      left: relativeLeft - scrollLeft
    };
  };

  const handleCodeChange = (newCode: string) => {
    onCodeChange(newCode);
    
    if (process.env.SQL_AUTO_COMPLETE === 'false') return;

    const textarea = editorRef.current?.textarea;
    if (!textarea) return;

    const cursorIndex = textarea.selectionStart;
    
    // Look backwards from cursor to find current word
    let start = cursorIndex;
    while (start > 0 && /[\w\d_]/.test(newCode[start - 1])) {
      start--;
    }
    const currentWord = newCode.substring(start, cursorIndex);

    if (currentWord.length >= 1) {
      const matches = allKeywords.filter(item => 
        item.label.toLowerCase().startsWith(currentWord.toLowerCase()) && 
        item.label !== currentWord // Don't suggest if fully typed (optional preference)
      ).slice(0, 8); // Limit to 8 suggestions

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

    // Restore focus and cursor
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + toInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
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
      <div className="px-8 py-4 bg-blue-50/30 border-b border-blue-100/50">
        <div className="relative group w-full">
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
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
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

        {/* Autocomplete Dropdown */}
        {showSuggestions && (
          <div 
            className="absolute z-50 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden min-w-[180px] max-w-[300px] animate-in fade-in zoom-in-95 duration-75"
            style={{ 
              top: cursorPosition.top, 
              left: cursorPosition.left 
            }}
          >
            <div className="text-[9px] font-black uppercase tracking-widest bg-gray-50 px-2 py-1 text-gray-400 border-b border-gray-100">
              Suggestions
            </div>
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
                  {item.detail && <span className="text-[9px] text-gray-400 font-sans">{item.detail}</span>}
                </div>
              </div>
            ))}
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
