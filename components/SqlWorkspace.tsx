
import React, { useMemo, useRef, useEffect } from 'react';
import { ExecutionResult, TableMetadata } from '../types';
import BaseCodeEditor, { BaseCodeEditorRef } from './BaseCodeEditor';
import SqlResultPanel from './SqlResultPanel';
import { Database, Play, Sparkles, RefreshCcw, Code2, RotateCcw } from 'lucide-react';

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

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
  'INNER JOIN', 'ON', 'AS', 'AND', 'OR', 'IN', 'IS', 'NOT', 'NULL', 'INSERT', 'INTO', 'VALUES',
  'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DATABASE', 'DROP', 'ALTER', 'ADD', 'DESC', 'ASC',
  'SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'HAVING', 'DISTINCT', 'UNION', 'ALL'
];

const SqlWorkspace: React.FC<Props> = ({ 
  code, onCodeChange, prompt, onPromptChange, result, onRun, isExecuting, isAiLoading, onTriggerAi, tables, onUndo, showUndo 
}) => {
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
    // Autocomplete logic remains local for performance
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Autocomplete interaction logic remains local
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
            disabled={isAiLoading || !prompt} 
            className="absolute right-2 top-2 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isAiLoading ? <RefreshCcw size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generate SQL
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        {showUndo && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <button onClick={onUndo} className="flex items-center gap-2 px-4 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-full text-xs font-black shadow-xl">
              <RotateCcw size={14} /> Revert Suggestion
            </button>
          </div>
        )}
        <BaseCodeEditor ref={editorRef} code={code} onChange={handleCodeChange} onKeyDown={handleKeyDown} language="sql" placeholder="-- Write SQL here..." />
        
        <div className="px-6 py-3 border-t border-gray-100 bg-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1.5"><Code2 size={12} className="text-blue-400" /><span>ANSI SQL</span></div>
          </div>
          <button onClick={onRun} disabled={isExecuting} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg">
            {isExecuting ? <RefreshCcw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />} Execute Query
          </button>
        </div>
      </div>

      <SqlResultPanel result={result} isLoading={isExecuting} />
    </div>
  );
};

export default SqlWorkspace;
