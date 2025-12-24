
import React from 'react';
import { Suggestion, DevMode } from '../types';
import { Sparkles, Terminal, Database, ArrowRight, RefreshCw, Layers } from 'lucide-react';

interface Props {
  suggestions: Suggestion[];
  onApply: (suggestion: Suggestion) => void;
  onFetchMore: () => void;
  isLoading: boolean;
}

const InsightHub: React.FC<Props> = ({ suggestions, onApply, onFetchMore, isLoading }) => {
  const sqlSuggestions = suggestions.filter(s => s.type === DevMode.SQL);
  const pythonSuggestions = suggestions.filter(s => s.type === DevMode.PYTHON);

  const GeneratingCard = ({ badgeClass }: { badgeClass: string }) => (
    <div className="bg-white border border-dashed border-blue-200 rounded-2xl p-5 flex flex-col items-center justify-center min-h-[180px] animate-pulse relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-transparent opacity-50"></div>
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider mb-2 ${badgeClass} opacity-50`}>
          AI Brainstorming
        </div>
        <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center shadow-inner">
           <RefreshCw size={18} className="animate-spin" />
        </div>
        <div className="text-center">
          <h4 className="text-sm font-bold text-gray-400">Generating Idea...</h4>
          <p className="text-[10px] text-gray-300 font-medium mt-1">Analyzing table semantics</p>
        </div>
      </div>
    </div>
  );

  const Section = ({ title, items, icon: Icon, colorClass, badgeClass, isGenerating }: any) => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
          <Icon size={18} className={colorClass.replace('bg-', 'text-')} />
        </div>
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item: Suggestion) => (
          <div 
            key={item.id} 
            className="group bg-white border border-gray-100 rounded-2xl p-5 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${badgeClass}`}>
                  {item.category}
                </span>
                <span className="text-[10px] font-bold text-gray-300">#{item.id.slice(0, 4)}</span>
              </div>
              <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2 line-clamp-1">
                {item.title}
              </h4>
              <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-2 mb-4">
                {item.prompt}
              </p>
            </div>
            <button
              onClick={() => onApply(item)}
              className="w-full py-2 bg-gray-50 text-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all group/btn"
            >
              Apply to Editor
              <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
        ))}
        {isGenerating && <GeneratingCard badgeClass={badgeClass} />}
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <Sparkles className="text-blue-600" size={24} />
              Insight Hub
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">AI-curated business questions based on your data structure.</p>
          </div>
          <button
            onClick={onFetchMore}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Layers size={16} />}
            Generate More Ideas
          </button>
        </div>

        {suggestions.length === 0 && !isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
              <Sparkles size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Discover New Insights</h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2">
              Our AI is analyzing your table schema to suggest relevant analysis prompts.
            </p>
            <button 
               onClick={onFetchMore}
               className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              Start Brainstorming
            </button>
          </div>
        ) : (
          <>
            <Section 
              title="Strategic Reporting (SQL)" 
              items={sqlSuggestions} 
              icon={Database} 
              colorClass="bg-blue-500"
              badgeClass="bg-blue-50 text-blue-600"
              isGenerating={isLoading}
            />
            <Section 
              title="Predictive Modeling (Python)" 
              items={pythonSuggestions} 
              icon={Terminal} 
              colorClass="bg-purple-500"
              badgeClass="bg-purple-50 text-purple-600"
              isGenerating={isLoading}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default InsightHub;
