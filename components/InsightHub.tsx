
import React, { useState, useRef, useEffect } from 'react';
import { Suggestion, DevMode } from '../types';
import { Sparkles, Terminal, Database, ArrowRight, RefreshCw, Layers, Trash2, PencilLine } from 'lucide-react';

interface Props {
  suggestions: Suggestion[];
  onApply: (suggestion: Suggestion) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, newPrompt: string) => void;
  onFetchMore: () => void;
  isLoading: boolean;
}

const GeneratingCard = ({ badgeClass }: { badgeClass: string }) => (
  <div className="bg-white border border-dashed border-blue-200 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[280px] animate-pulse relative overflow-hidden group">
    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-transparent opacity-50"></div>
    <div className="relative z-10 flex flex-col items-center gap-3">
      <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider mb-2 ${badgeClass} opacity-50`}>
        AI Brainstorming
      </div>
      <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center shadow-inner">
         <RefreshCw size={20} className="animate-spin" />
      </div>
      <div className="text-center">
        <h4 className="text-sm font-bold text-gray-400">Generating Idea...</h4>
        <p className="text-[10px] text-gray-300 font-medium mt-1">Analyzing table semantics</p>
      </div>
    </div>
  </div>
);

interface SectionProps {
  title: string;
  items: Suggestion[];
  icon: any;
  colorClass: string;
  badgeClass: string;
  isGenerating: boolean;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  editingId: string | null;
  editValue: string;
  setEditValue: (val: string) => void;
  startEditing: (e: React.MouseEvent, item: Suggestion) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  onDelete: (id: string) => void;
  onApply: (item: Suggestion) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

const Section: React.FC<SectionProps> = ({ 
  title, items, icon: Icon, colorClass, badgeClass, isGenerating,
  expandedIds, toggleExpand, editingId, editValue, setEditValue,
  startEditing, saveEdit, cancelEdit, onDelete, onApply, textareaRef
}) => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${colorClass} bg-opacity-10`}>
        <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
      </div>
      <h3 className="text-base font-black text-gray-800 uppercase tracking-tight">{title}</h3>
    </div>
    <div 
      className="grid gap-6"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}
    >
      {items.map((item: Suggestion) => {
        const itemId = item.id || `${item.title}-${item.type}`;
        const isExpanded = expandedIds.has(itemId);
        const isEditing = editingId === itemId;
        
        return (
          <div 
            key={itemId} 
            onMouseEnter={() => toggleExpand(itemId)}
            className={`group bg-white border rounded-[2.5rem] p-7 transition-all flex flex-col justify-between min-h-[280px] relative ${
              isEditing ? 'border-blue-400 shadow-lg ring-1 ring-blue-100' : 'border-gray-100 hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-500/10'
            }`}
          >
            {/* Minimal Header Controls */}
            {!isEditing && (
              <div className="absolute top-6 right-6 flex items-center gap-1 z-10">
                <button 
                  onClick={() => onDelete(itemId)}
                  className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50"
                  title="Remove Insight"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}

            <div className="flex flex-col h-full">
              <div className="flex justify-between items-start mb-4 pr-16">
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${badgeClass}`}>
                  {item.category}
                </span>
                <span className="text-[10px] font-bold text-gray-300 font-mono">#{ itemId.slice(0, 4).toUpperCase() }</span>
              </div>
              
              <h4 className="text-base font-black text-gray-900 group-hover:text-blue-600 transition-colors mb-3 leading-tight pr-8">
                {item.title}
              </h4>
              
              <div className="flex-1 relative">
                {isEditing ? (
                  <textarea
                    ref={textareaRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveEdit}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    // Note: Padding/LineHeight must match the display paragraph exactly to prevent jumping
                    className="w-full h-32 text-xs text-gray-600 font-medium leading-relaxed bg-blue-50/30 p-0 border-none focus:outline-none focus:ring-0 resize-none overflow-auto"
                  />
                ) : (
                  <div className="relative group/text">
                    <p 
                      onClick={(e) => startEditing(e, item)}
                      className={`text-xs text-gray-500 font-medium leading-relaxed transition-all duration-300 ease-in-out mb-6 cursor-text hover:text-gray-900 ${isExpanded ? 'line-clamp-none' : 'line-clamp-4'}`}
                    >
                      {item.prompt}
                    </p>
                    <div className="absolute -right-1 -top-1 opacity-0 group-hover/text:opacity-40 pointer-events-none transition-opacity">
                       <PencilLine size={12} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {!isEditing && (
              <button
                onClick={() => onApply(item)}
                className="w-full py-3 bg-gray-50 text-gray-600 rounded-2xl text-xs font-black flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all group/btn shadow-sm"
              >
                Apply to Editor
                <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        );
      })}
      {isGenerating && <GeneratingCard badgeClass={badgeClass} />}
    </div>
  </div>
);

const InsightHub: React.FC<Props> = ({ suggestions, onApply, onDelete, onUpdate, onFetchMore, isLoading }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const sqlSuggestions = suggestions.filter(s => s.type === DevMode.SQL);
  const pythonSuggestions = suggestions.filter(s => s.type === DevMode.PYTHON);

  const toggleExpand = (id: string) => {
    if (expandedIds.has(id)) return;
    setExpandedIds(prev => new Set(prev).add(id));
  };

  const startEditing = (e: React.MouseEvent, item: Suggestion) => {
    e.stopPropagation();
    const itemId = item.id || `${item.title}-${item.type}`;
    setEditingId(itemId);
    setEditValue(item.prompt);
    setOriginalValue(item.prompt);
  };

  const saveEdit = () => {
    if (editingId !== null) {
      const trimmed = editValue.trim();
      // Only trigger update if content has actually changed
      if (trimmed && trimmed !== originalValue) {
        onUpdate(editingId, trimmed);
      }
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editingId]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-10">
      <div className="w-full space-y-16">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-4">
              <Sparkles className="text-blue-600" size={32} />
              Insight Hub
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-2">AI-curated business questions automatically derived from your active data schema.</p>
          </div>
          <button
            onClick={onFetchMore}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-black text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Layers size={18} />}
            Brainstorm More Ideas
          </button>
        </div>

        {suggestions.length === 0 && !isLoading ? (
          <div className="py-32 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
              <Sparkles size={40} />
            </div>
            <h3 className="text-xl font-black text-gray-900">Discover New Insights</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mt-3 font-medium">
              We'll analyze your table schema to suggest relevant analysis prompts for SQL and Python.
            </p>
            <button 
               onClick={onFetchMore}
               className="mt-10 px-10 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-95"
            >
              Start Generating Ideas
            </button>
          </div>
        ) : (
          <div className="space-y-20">
            <Section 
              title="Strategic Reporting (SQL)" 
              items={sqlSuggestions} 
              icon={Database} 
              colorClass="bg-blue-500"
              badgeClass="bg-blue-50 text-blue-600"
              isGenerating={isLoading}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              editingId={editingId}
              editValue={editValue}
              setEditValue={setEditValue}
              startEditing={startEditing}
              saveEdit={saveEdit}
              cancelEdit={cancelEdit}
              onDelete={onDelete}
              onApply={onApply}
              textareaRef={textareaRef}
            />
            <Section 
              title="Predictive Modeling (Python)" 
              items={pythonSuggestions} 
              icon={Terminal} 
              colorClass="bg-purple-500"
              badgeClass="bg-purple-50 text-purple-600"
              isGenerating={isLoading}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              editingId={editingId}
              editValue={editValue}
              setEditValue={setEditValue}
              startEditing={startEditing}
              saveEdit={saveEdit}
              cancelEdit={cancelEdit}
              onDelete={onDelete}
              onApply={onApply}
              textareaRef={textareaRef}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightHub;
