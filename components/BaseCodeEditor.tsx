
import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { useMonaco, loader } from '@monaco-editor/react';
import { TableMetadata } from '../types';

// Pre-load Monaco from CDN to avoid huge bundle
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs',
  },
});

interface Props {
  code: string;
  onChange: (val: string) => void;
  language: 'sql' | 'python';
  readOnly?: boolean;
  placeholder?: string;
  tables?: TableMetadata[]; // Added for Autocomplete
}

const BaseCodeEditor: React.FC<Props> = ({ 
  code, onChange, language, readOnly = false, tables
}) => {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  // Register SQL Completion Provider based on Tables schema
  useEffect(() => {
    if (monaco && language === 'sql' && tables) {
      const disposable = monaco.languages.registerCompletionItemProvider('sql', {
        provideCompletionItems: (model, position) => {
          const suggestions: any[] = [];
          
          // Add Tables
          tables.forEach(table => {
            suggestions.push({
              label: table.tableName,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: table.tableName,
              detail: 'Table',
              documentation: `Row count: ${table.rowCount}`
            });

            // Add Columns
            table.columns.forEach(col => {
              suggestions.push({
                label: col.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
                detail: `${table.tableName} (${col.type})`,
                documentation: col.comment
              });
            });
          });

          // Add Standard SQL Keywords (if not handled by default, though Monaco usually has them)
          const keywords = [
            'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'JOIN', 
            'LEFT JOIN', 'INNER JOIN', 'ON', 'AS', 'DISTINCT', 'COUNT', 'SUM', 
            'AVG', 'MAX', 'MIN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
          ];
          
          keywords.forEach(kw => {
             suggestions.push({
                label: kw,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: kw
             });
          });

          return { suggestions };
        }
      });

      return () => disposable.dispose();
    }
  }, [monaco, language, tables]);

  return (
    <div className="flex-1 relative h-full w-full bg-white group">
      <Editor
        height="100%"
        language={language}
        value={code}
        onChange={(value) => onChange(value || '')}
        onMount={handleEditorDidMount}
        theme="light"
        options={{
          readOnly,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
          minimap: { enabled: false }, // Clean look
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          roundedSelection: false,
          padding: { top: 16, bottom: 16 },
          automaticLayout: true,
          renderLineHighlight: 'all',
          cursorBlinking: 'smooth',
          smoothScrolling: true,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            vertical: 'visible',
            horizontal: 'auto',
            useShadows: false,
            verticalScrollbarSize: 10
          }
        }}
      />
      {readOnly && (
        <div className="absolute inset-0 z-10 bg-gray-50/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 px-4 py-2 rounded-full border border-gray-100 shadow-lg flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">AI Generating...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BaseCodeEditor;
