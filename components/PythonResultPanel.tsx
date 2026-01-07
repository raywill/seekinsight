
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExecutionResult } from '../types';
import { Terminal as TerminalIcon, BarChart, Clock, Play, Box, Sparkles, RefreshCw, Maximize2, Minimize2, Eye, Info, Hash, ChevronUp, ChevronDown, Image as ImageIcon, Copy, Check, Code } from 'lucide-react';
import Plot from 'react-plotly.js';

interface Props {
  result: ExecutionResult | null;
  previewResult?: ExecutionResult | null; // New prop for preview
  isLoading: boolean;
  onDebug?: () => void;
  isAiLoading?: boolean;
  fullHeight?: boolean;
}

const MIN_HEIGHT = 240;

// Reusing SimpleMarkdown logic locally for console rendering
const ConsoleMarkdown = ({ content }: { content: string }) => {
  if (!content) return null;
  const lines = content.split('\n');
  return (
    <div className="space-y-2 font-sans text-gray-700 bg-white p-3 rounded border border-gray-100 shadow-sm my-2">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('###')) return <h3 key={i} className="text-sm font-black text-gray-900 mt-2 mb-1 uppercase tracking-tight">{trimmed.replace(/^###\s*/, '')}</h3>;
        if (trimmed.startsWith('##')) return <h2 key={i} className="text-base font-black text-gray-900 mt-3 mb-2 border-b border-gray-100 pb-1">{trimmed.replace(/^##\s*/, '')}</h2>;
        if (trimmed.startsWith('#')) return <h1 key={i} className="text-lg font-black text-gray-900 mt-4 mb-2">{trimmed.replace(/^#\s*/, '')}</h1>;
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          return (
            <div key={i} className="flex gap-2 items-start pl-1">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
              <p className="text-xs text-gray-600 font-medium leading-relaxed">{trimmed.replace(/^[-*]\s*/, '')}</p>
            </div>
          );
        }
        if (!trimmed) return <div key={i} className="h-1" />;
        
        const formattedLine = trimmed.replace(/\*\*(.*?)\*\*/g, '<b class="font-black text-gray-800">$1</b>');
        return <p key={i} className="text-xs text-gray-600 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedLine }} />;
      })}
    </div>
  );
};

// Safe HTML Renderer using Iframe
const ConsoleHtml = ({ content, height }: { content: string, height?: number }) => {
  return (
    <div className="my-2 rounded border border-gray-200 overflow-hidden bg-white shadow-sm">
      <iframe
        srcDoc={`
          <html>
            <head>
              <style>
                body { margin: 0; padding: 12px; font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 12px; color: #374151; }
                table { border-collapse: collapse; width: 100%; border: 1px solid #e5e7eb; }
                th { background: #f9fafb; font-weight: 700; text-transform: uppercase; font-size: 10px; padding: 8px; text-align: left; color: #6b7280; }
                td { border-top: 1px solid #e5e7eb; padding: 8px; }
                tr:nth-child(even) { background: #f9fafb; }
                a { color: #2563eb; text-decoration: none; }
                a:hover { text-decoration: underline; }
              </style>
            </head>
            <body>${content}</body>
          </html>
        `}
        style={{ width: '100%', height: height || 300, border: 'none' }}
        sandbox="allow-scripts"
      />
    </div>
  );
};

const PythonResultPanel: React.FC<Props> = ({ result, previewResult, isLoading, onDebug, isAiLoading, fullHeight = false }) => {
  const [activeTab, setActiveTab] = useState<'console' | 'plot' | 'preview'>('console');
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(!fullHeight); 
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [copiedLogs, setCopiedLogs] = useState(false);
  
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);

  const hasError = result?.isError || (result?.logs && result.logs.some(l => l.toLowerCase().includes('error') || l.toLowerCase().includes('traceback')));

  useEffect(() => {
    if (fullHeight) return;
    if (isLoading) {
        setIsCollapsed(false);
    } else if (result || previewResult) {
        setIsCollapsed(false);
    }
  }, [isLoading, result, previewResult, fullHeight]);

  const startResize = useCallback((e: React.MouseEvent) => {
    if (fullHeight || isFullscreen) return;
    setIsResizing(true);
    startY.current = e.pageY;
    startHeight.current = height;
    document.body.style.cursor = 'ns-resize';
  }, [height, fullHeight, isFullscreen]);

  const stopResize = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = 'default';
  }, []);

  const onResize = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const delta = startY.current - e.pageY;
    setHeight(Math.max(MIN_HEIGHT, startHeight.current + delta));
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', onResize);
      window.addEventListener('mouseup', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', onResize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing, onResize, stopResize]);

  useEffect(() => {
    if (previewResult) {
        setActiveTab('preview');
        return;
    }
    if (result) {
      if (hasError) {
        setActiveTab('console');
      } else if (result.plotlyData) {
        setActiveTab('plot');
      } else {
        setActiveTab('console');
      }
    }
  }, [result, previewResult, hasError]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) {
            setPreviewImage(null);
        } else if (isFullscreen) {
            toggleFullscreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, previewImage]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  };

  const handleCopyLogs = async () => {
    if (!result?.logs || result.logs.length === 0) return;
    // Filter out block markers before copying
    const text = result.logs
        .filter(l => !l.startsWith('__SI_DISPLAY_BLOCK__:'))
        .join('\n');
    
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for non-secure contexts
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
            }
            
            document.body.removeChild(textArea);
        }
        setCopiedLogs(true);
        setTimeout(() => setCopiedLogs(false), 2000);
    } catch (err) {
        console.error('Failed to copy logs:', err);
    }
  };

  const renderCellContent = (value: any) => {
      let strVal = '';
      
      // Robust conversion logic
      if (value === null || value === undefined) {
          strVal = 'NULL';
      } else if (typeof value === 'object') {
          // Check for Node/MySQL Buffer format: { type: 'Buffer', data: [...] }
          if (value.type === 'Buffer' && Array.isArray(value.data)) {
              const bytes = new Uint8Array(value.data);
              
              // 1. Check Magic Numbers for Image Types
              let mimeType = null;
              if (bytes.length > 2 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) mimeType = 'jpeg';
              else if (bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) mimeType = 'png';
              else if (bytes.length > 2 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) mimeType = 'gif';
              else if (bytes.length > 1 && bytes[0] === 0x42 && bytes[1] === 0x4D) mimeType = 'bmp';

              if (mimeType) {
                  // Convert raw bytes to Base64
                  let binary = '';
                  const len = bytes.byteLength;
                  for (let i = 0; i < len; i++) {
                      binary += String.fromCharCode(bytes[i]);
                  }
                  try {
                      const base64 = window.btoa(binary);
                      strVal = `data:image/${mimeType};base64,${base64}`;
                  } catch (e) {
                      strVal = '[Image Data Error]';
                  }
              } else {
                  // 2. Fallback to Text Decode
                  try {
                      strVal = new TextDecoder('utf-8').decode(bytes);
                  } catch (e) {
                      strVal = JSON.stringify(value);
                  }
              }
          } else {
              strVal = JSON.stringify(value);
          }
      } else {
          strVal = String(value);
      }
      
      if (strVal.startsWith('data:image/')) {
          return (
              <div 
                className="group/img relative inline-block cursor-zoom-in"
                onClick={(e) => { e.stopPropagation(); setPreviewImage(strVal); }}
              >
                  <img 
                    src={strVal} 
                    alt="Cell Content" 
                    className="h-10 w-auto min-w-[40px] object-contain rounded border border-gray-200 bg-gray-50/50 hover:border-blue-300 transition-all" 
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-colors rounded flex items-center justify-center">
                      <ImageIcon size={12} className="text-white opacity-0 group-hover/img:opacity-100 drop-shadow-md" />
                  </div>
              </div>
          );
      }
      
      return (
        <span className="truncate block" title={strVal}>
            {strVal}
        </span>
      );
  };

  if (isCollapsed && !fullHeight) {
    return (
        <div className="h-9 border-t border-gray-200 bg-white flex items-center justify-between px-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setIsCollapsed(false)}>
            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 text-xs font-bold ${hasError ? 'text-red-600' : 'text-purple-600'}`}>
                    {isLoading ? <RefreshCw size={14} className="animate-spin" /> : (hasError ? <Info size={14} /> : <TerminalIcon size={14} />)}
                    {isLoading ? 'Running Script...' : (
                        hasError ? 'Execution Failed' : (
                            result ? 'Script Completed' : (previewResult ? 'Preview Mode Active' : 'Ready to Execute')
                        )
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
               <span className="text-[10px] font-mono">{result?.timestamp || previewResult?.timestamp || ''}</span>
               <ChevronUp size={14} />
            </div>
        </div>
    )
  }

  const containerStyle: React.CSSProperties = isFullscreen 
    ? { position: 'fixed', inset: 0, zIndex: 200, width: '100vw', height: '100vh' }
    : (fullHeight ? { height: '100%', flex: 1, width: '100%' } : { height });

  const containerClasses = isFullscreen
    ? "bg-white flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
    : `${fullHeight ? '' : 'border-t border-gray-200'} bg-white flex flex-col overflow-hidden relative group/resizer`;

  return (
    <div style={containerStyle} className={containerClasses}>
      {isFullscreen && <div className="absolute inset-0 bg-white z-0" />}

      {/* Image Preview Modal Overlay */}
      {previewImage && (
          <div 
            className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200"
            onClick={() => setPreviewImage(null)}
          >
              <div className="relative max-w-full max-h-full">
                  <img 
                    src={previewImage} 
                    alt="Full Preview" 
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                  />
                  <button 
                    className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
                    onClick={() => setPreviewImage(null)}
                  >
                      Close [Esc]
                  </button>
              </div>
          </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
             <div className="bg-white/60 border border-purple-100/50 shadow-lg shadow-purple-500/5 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-200">
                <RefreshCw size={14} className="text-purple-600 animate-spin" />
                <span className="text-[11px] font-black text-gray-700 uppercase tracking-wider">Running Script...</span>
             </div>
        </div>
      )}

      {!fullHeight && !isFullscreen && (
        <div onMouseDown={startResize} className="absolute top-0 left-0 w-full h-1 cursor-ns-resize hover:bg-purple-500 z-50 flex items-center justify-center">
          <div className="w-8 h-1 bg-gray-200 rounded-full group-hover/resizer:bg-purple-400"></div>
        </div>
      )}

      {/* Header */}
      <div className={`relative z-10 px-4 py-2 border-b border-gray-100 flex items-center justify-between shrink-0 ${hasError && !previewResult ? 'bg-red-50/50' : 'bg-gray-50'}`}>
        <div className="flex gap-1">
          <button onClick={() => setActiveTab('console')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'console' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            <TerminalIcon size={12} className="inline mr-1.5" /> {hasError ? 'Error Console' : 'Stdout/Stderr'}
          </button>
          
          {result?.plotlyData && (
            <button onClick={() => setActiveTab('plot')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'plot' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
              <BarChart size={12} className="inline mr-1.5" /> Interactive Plot
            </button>
          )}

          {previewResult && (
            <button onClick={() => setActiveTab('preview')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'preview' ? 'bg-amber-100 text-amber-700 shadow-sm border border-amber-200' : 'text-gray-400 hover:text-gray-600'}`}>
              <Eye size={12} /> Data Preview
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          
          <div className="text-[10px] font-mono text-gray-400 uppercase font-bold tracking-wider hidden sm:block">
            PY3.10 • {result?.timestamp || previewResult?.timestamp}
          </div>

          {activeTab === 'console' && result?.logs && result.logs.length > 0 && (
             <button 
                onClick={handleCopyLogs}
                className={`p-1.5 rounded-lg transition-all ${copiedLogs ? 'bg-green-50 text-green-600' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'}`}
                title={copiedLogs ? "Copied!" : "Copy Output"}
             >
                {copiedLogs ? <Check size={14} /> : <Copy size={14} />}
             </button>
          )}

          <button 
            onClick={toggleFullscreen}
            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Maximize Panel"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {!fullHeight && (
              <button 
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                title="Collapse"
              >
                <ChevronDown size={14} />
              </button>
          )}
        </div>
      </div>

      <div className="relative z-10 flex-1 relative overflow-hidden bg-white">
        
         {!result && !previewResult && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-gray-300">
                <TerminalIcon size={24} className="opacity-10 mb-2" />
                <p className="text-xs font-black uppercase tracking-widest">Ready for Scripting</p>
            </div>
         )}

        {/* PREVIEW TAB CONTENT */}
        {activeTab === 'preview' && previewResult && (
            <div className="flex flex-col h-full bg-amber-50/10">
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-[10px] text-amber-700 font-medium shrink-0">
                    <Info size={12} />
                    <span>System Preview: Showing top 10 sample rows. This data was not generated by your script.</span>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="min-w-full text-left text-[11px] border-collapse font-mono">
                        <thead className="sticky top-0 bg-white shadow-sm z-10">
                            <tr className="border-b border-gray-200">
                            {previewResult.columns.map(col => (
                                <th key={col} className="px-3 py-2 font-black text-gray-500 uppercase tracking-tighter bg-gray-50/80">
                                <div className="flex items-center gap-1"><Hash size={10} />{col}</div>
                                </th>
                            ))}
                            </tr>
                        </thead>
                        <tbody>
                            {previewResult.data.map((row, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/50">
                                {previewResult.columns.map(col => (
                                <td key={col} className="px-3 py-1.5 text-gray-600 max-w-xs hover:bg-blue-50/30 align-top">
                                    {renderCellContent(row[col])}
                                </td>
                                ))}
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* CONSOLE TAB CONTENT */}
        {activeTab === 'console' && result && (
            <div className={`h-full overflow-auto p-4 font-mono text-[13px] leading-relaxed ${hasError ? 'bg-red-50/5 text-red-700' : 'text-gray-700'}`}>
              {result?.logs?.map((log, idx) => {
                // Check if this log is a special display block
                if (log.startsWith('__SI_DISPLAY_BLOCK__:')) {
                    try {
                        const payload = JSON.parse(log.substring('__SI_DISPLAY_BLOCK__:'.length));
                        if (payload.type === 'html') {
                            return <ConsoleHtml key={idx} content={payload.content} height={payload.height} />;
                        }
                        if (payload.type === 'markdown') {
                            return <ConsoleMarkdown key={idx} content={payload.content} />;
                        }
                    } catch (e) {
                        return <div key={idx} className="text-red-400 text-xs italic">[Rich Content Render Error]</div>;
                    }
                    return null;
                }

                return (
                    <div key={idx} className="flex gap-3 py-0.5">
                    <span className="text-gray-300 select-none font-bold">[{idx+1}]</span>
                    <span className={log.toLowerCase().includes('error') || log.toLowerCase().includes('traceback') ? 'text-red-500 font-bold' : ''}>{log}</span>
                    </div>
                );
              })}
              {result?.logs?.length === 0 && <span className="text-gray-400 italic font-medium">Script completed with no stdout output.</span>}
            </div>
        )}

        {/* PLOT TAB CONTENT */}
        {activeTab === 'plot' && result?.plotlyData && (
            <div className="h-full bg-white p-4">
              <Plot
                data={result.plotlyData?.data || []}
                layout={{
                  ...result.plotlyData?.layout,
                  width: undefined, // Force autosize
                  height: undefined, // Force autosize
                  autosize: true,
                  margin: isFullscreen ? { t: 50, r: 50, b: 50, l: 50 } : { t: 30, r: 30, b: 30, l: 30 },
                  font: { family: 'Inter', size: isFullscreen ? 12 : 10 }
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ responsive: true, displaylogo: false }}
              />
            </div>
        )}

        {hasError && onDebug && activeTab === 'console' && (
          <div className="absolute bottom-6 right-6 animate-in fade-in slide-in-from-bottom-4 duration-500 z-[60]">
            <button 
              onClick={onDebug}
              disabled={isAiLoading}
              className="flex items-center gap-3 px-6 py-3.5 bg-red-600 text-white rounded-2xl text-[11px] font-black shadow-[0_10px_40px_rgba(220,38,38,0.4)] hover:bg-red-700 hover:shadow-red-500/50 transition-all active:scale-95 disabled:opacity-80 group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              {isAiLoading ? (
                <RefreshCw size={16} className="animate-spin text-white" />
              ) : (
                <Sparkles size={16} className="text-white animate-pulse" />
              )}
              <span className="uppercase tracking-[0.1em]">
                {isAiLoading ? 'Python Repair in Progress...' : 'AI Magic Fix'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PythonResultPanel;
