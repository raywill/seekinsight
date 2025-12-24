
import React, { useState } from 'react';
import { ExecutionResult } from '../types';
import { FileText, BarChart3, Rocket, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

interface Props {
  result: ExecutionResult | null;
  analysis: string;
  isAnalyzing: boolean;
  onDeploy: () => Promise<void>;
  isDeploying: boolean;
}

const SqlPublishPanel: React.FC<Props> = ({ result, analysis, isAnalyzing, onDeploy, isDeploying }) => {
  const [tab, setTab] = useState<'report' | 'viz'>('report');
  const [deployed, setDeployed] = useState(false);

  const handleDeploy = async () => {
    await onDeploy();
    setDeployed(true);
    setTimeout(() => setDeployed(false), 3000);
  };

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="flex border-b border-gray-200 bg-gray-50/50">
        <button onClick={() => setTab('report')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${tab === 'report' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400'}`}>
          <FileText size={14} className="inline mr-2" /> Report
        </button>
        <button onClick={() => setTab('viz')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${tab === 'viz' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400'}`}>
          <BarChart3 size={14} className="inline mr-2" /> Visuals
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'report' ? (
          <div className="space-y-6">
            <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={14} className="text-blue-500" /> AI Insights
            </h2>
            {isAnalyzing ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-full"></div>
                <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                <div className="h-4 bg-gray-100 rounded w-4/6"></div>
              </div>
            ) : analysis ? (
              <div className="text-[13px] text-gray-600 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br/>') }} />
            ) : (
              <p className="text-xs text-gray-300 italic">No analysis generated yet.</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Recommended Visuals</h2>
            <div className="aspect-video bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300">
               <BarChart3 size={24} className="opacity-20 mb-2" />
               <span className="text-[10px] font-bold">Waiting for Data...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-gray-50 border-t border-gray-100">
        <button onClick={handleDeploy} disabled={isDeploying || !result} className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-black transition-all">
          {isDeploying ? <RefreshCw size={16} className="animate-spin" /> : (deployed ? <CheckCircle2 size={16} /> : <Rocket size={16} />)}
          {deployed ? 'PUBLISHED' : 'DEPLOY REPORT APP'}
        </button>
      </div>
    </div>
  );
};

export default SqlPublishPanel;
