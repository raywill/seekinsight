
import React, { useRef, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-python';

interface Props {
  code: string;
  onChange: (val: string) => void;
  language: 'sql' | 'python';
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  readOnly?: boolean;
}

export interface BaseCodeEditorRef {
  textarea: HTMLTextAreaElement | null;
}

const BaseCodeEditor = forwardRef<BaseCodeEditorRef, Props>(({ 
  code, onChange, language, placeholder, onKeyDown, readOnly = false
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  useImperativeHandle(ref, () => ({
    textarea: textareaRef.current
  }));

  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleInternalKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    if (e.key === 'Tab') {
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newValue = code.substring(0, start) + '    ' + code.substring(end);
      onChange(newValue);
      e.preventDefault();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
    
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const highlightedCode = useMemo(() => {
    const grammar = Prism.languages[language];
    if (!grammar) return code;
    return Prism.highlight(code || '', grammar, language);
  }, [code, language]);

  useEffect(() => { handleScroll(); }, [code, language]);

  return (
    <div className={`flex-1 relative prism-editor-container group bg-white ${readOnly ? 'opacity-75 cursor-not-allowed' : ''}`}>
      <textarea
        ref={textareaRef}
        value={code}
        onChange={(e) => !readOnly && onChange(e.target.value)}
        onScroll={handleScroll}
        onKeyDown={handleInternalKeyDown}
        className="prism-editor-textarea"
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        placeholder={placeholder}
        readOnly={readOnly}
      />
      <pre ref={preRef} className="prism-editor-pre" aria-hidden="true">
        <code 
          className={`language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlightedCode + (code.endsWith('\n') ? '\n ' : '\n') }} 
        />
      </pre>
      {readOnly && (
        <div className="absolute inset-0 z-10 bg-gray-50/5 flex items-center justify-center pointer-events-none">
          <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-100 shadow-sm flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AI Recalibrating...</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default BaseCodeEditor;
