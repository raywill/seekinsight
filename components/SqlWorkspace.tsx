
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

  const updateSuggestions = (currentCode: string, cursorIndex: number) => {
    if (process.env.SQL_AUTO_COMPLETE === 'false') return;

    // Look backwards from cursor to find current word
    let start = cursorIndex;
    // Modified regex to include English letters, numbers, underscores AND Unicode chars (Chinese, etc.)
    // Matches any char that is NOT a separator (whitespace, punctuation, brackets, quotes)
    while (start > 0 && /[a-zA-Z0-9_\u0080-\uFFFF]/.test(currentCode[start - 1])) {
      start--;
    }
    const currentWord = currentCode.substring(start, cursorIndex);

    if (currentWord.length >= 1) {
      const matches = allKeywords.filter(item => 
        item.label.toLowerCase().startsWith(currentWord.toLowerCase()) && 
        item.label !== currentWord 
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

  const handleCodeChange = (newCode: string) => {
    onCodeChange(newCode);
    
    // Defer suggestion update slightly to allow state/dom update
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

    // Restore focus and cursor
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

    // Ctrl+Space trigger
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
      <div className="px-8 py-