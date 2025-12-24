
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ExecutionResult, TableMetadata, DevMode } from '../types';
import BaseCodeEditor, { BaseCodeEditorRef } from './BaseCodeEditor';
import ResultPanel from './ResultPanel';
import { Database, Play, Sparkles, RefreshCcw, Code2, Hash, Table as TableIcon, RotateCcw } from 'lucide-react';
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

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
  'INNER JOIN', 'ON', 'AS', 'AND', 'OR', 'IN', 'IS', 'NOT', 'NULL', 'INSERT', 'INTO', 'VALUES',
  'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DATABASE', 'DROP', 'ALTER', 'ADD', 'DESC', 'ASC',
  'SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'HAVING', 'DISTINCT', 'UNION', 'ALL'
];

const SqlWorkspace: React.FC<Props> = ({ 
  code, onCodeChange, prompt, onPromptChange, promptId, result, onRun, isExecuting, tables, onUndo, showUndo 
}) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const editorRef = useRef<BaseCodeEditorRef>(null);

  const isAutocompleteEnabled = process.env.SQL_AUTO_COMPLETE !== 'false';

  const allSuggestions = useMemo(() => {
    const tableNames = tables.map(t => t.tableName);
    const columnNames = Array.from(new Set(tables.flatMap(t => t.columns.map(c => c.name))));
    return {
      keywords: SQL_KEYWORDS,
      tables: tableNames,
      columns: columnNames
    };
  }, [tables]);

  const handleCodeChange = (newCode: string) => {
    onCodeChange(newCode);

    if (!isAutocompleteEnabled) return;

    const textarea = editorRef.current?.textarea;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = newCode.substring(0, cursorPosition);
    const words = textBeforeCursor.split(/[\s,();]+/);
    const lastWord = words[words.length - 1];

    if (lastWord.length >= 1) {
      const filtered = [
        ...allSuggestions.keywords.filter(k => k.toLowerCase().startsWith(lastWord.toLowerCase()) && k.toLowerCase() !== lastWord.toLowerCase()),
        ...allSuggestions.tables.filter(t => t.toLowerCase().startsWith(lastWord.toLowerCase()) && t.toLowerCase() !== lastWord.toLowerCase()),
        ...allSuggestions.columns.filter(c => c.toLowerCase().startsWith(lastWord.toLowerCase()) && c.toLowerCase() !== lastWord.toLowerCase())
      ].slice(0, 10);

      if (filtered.length > 0) {
        setSuggestions(filtered);
        setShowAutocomplete(true);
        setSelectedIndex(0);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const insertSuggestion = (suggestion: string) => {
    const textarea = editorRef.current?.textarea;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = code.substring(0, cursorPosition);
    const words = textBeforeCursor.split(/([\s,();]+)/);
    
    words[words.length - 1] = suggestion;
    
    const newTextBefore = words.join('');
    const newCode = newTextBefore + code.substring(cursorPosition);
    
    onCodeChange(newCode);
    setShowAutocomplete(false);

    setTimeout(() => {
      if (textarea) {
        const newPos = newTextBefore.length;
        textarea.selectionStart = textarea.selectionEnd = newPos;
        textarea.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowAutocomplete(false);
      }
    }
  };

  const handleAiAsk = async () => {
    if (!prompt.trim()) return;
    setIsAiLoading(true);
    setUndoVisible(false); // Reset undo visibility when starting a new generation
    try {
      const generated = await ai.generateCode(prompt, DevMode.SQL, tables);
      onCodeChange(generated);
      // Logic: Only show the Revert button AFTER the content is actually replaced
      if (showUndo) {
        setUndoVisible(true);
      }
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

  // Logic 2: Smart Auto-Hide timer for the Undo button
  useEffect(() => {
    let timer: any;
    if (undoVisible) {
      timer = setTimeout(() => {
        setUndoVisible(false);
      }, 10000); // 10s auto-hide
    }
    return () => clearTimeout(timer);
  }, [undoVisible]);

  // Reset local undo state if showUndo prop becomes false (e.g., after successful undo or navigation)
  useEffect(() => {
    if (!showUndo) setUndoVisible(false);
  }, [showUndo]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
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
        {undoVisible && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-in slide-in-from-top duration-300">
            <button 
              onClick={() => {
                if (onUndo) onUndo();
                setUndoVisible(false);
              }}
              className="flex items-center gap-2 px-4 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-full text-xs font-black shadow-xl hover:bg-blue-50 transition-all border-b-2 active:translate-y-0.5"
            >
              <RotateCcw size={14} />
              Revert Suggestion
            </button>
          </div>
        )}

        <BaseCodeEditor 
          ref={editorRef}
          code={code} 
          onChange={handleCodeChange} 
          onKeyDown={handleKeyDown}
          language="sql" 
          placeholder="-- Write your SQL here..." 
        />
        
        {showAutocomplete && (
          <div className="absolute left-8 bottom-16 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suggestions</span>
              <span className="text-[9px] text-gray-300 font-bold">↑↓ to navigate</span>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {suggestions.map((s, i) => {
                const isTable = allSuggestions.tables.includes(s);
                const isColumn = allSuggestions.columns.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => insertSuggestion(s)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                      i === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                    }`}
                  >
                    {isTable ? (
                      <TableIcon size={12} className="text-orange-400" />
                    ) : isColumn ? (
                      <Hash size={12} className="text-blue-400" />
                    ) : (
                      <Code2 size={12} className="text-gray-400" />
                    )}
                    <span className={`text-xs font-mono ${i === selectedIndex ? 'font-bold' : ''}`}>{s}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
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
