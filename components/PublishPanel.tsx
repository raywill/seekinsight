
import React, { useState } from 'react';
import { DevMode, ExecutionResult, AIChartConfig } from '../types';
import { SI_ENABLE_AI_CHART } from '../constants';
import { FileText, BarChart3, Rocket, CheckCircle2, LayoutDashboard, Settings2, FileOutput, Sparkles, HelpCircle, RefreshCw, Layers, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

interface Props {
  mode: DevMode;
  result: ExecutionResult | null;
  analysis: string;
  isAnalyzing: boolean;
  isRecommendingCharts: boolean;
  onDeploy: () => Promise<void>;
  isDeploying: boolean;
}

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#1d4ed8', '#1e40af'];

const PublishPanel: React.FC<Props> = ({ mode, result, analysis, isAnalyzing, isRecommendingCharts, onDeploy, isDeploying }) => {
  const [tab, setTab] = useState<'report' | 'viz'>('report');
  const [deploySuccess, setDeploySuccess] = useState(false);

  const handleDeploy = async () => {
    await onDeploy();
    setDeploySuccess(true);
    setTimeout(() => setDeploySuccess(false), 3000);
  };

  const LoadingCard = ({ title, icon: Icon }: { title: string, icon: any }) => (
    <div className="bg-white border border-dashed border-blue-100 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 animate-pulse">
       <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
          <Icon className="animate-spin" size={20} />
       </div>
       <div>
         <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</h4>
         <p className="text-[10px] text-gray-300 mt-1">Generating deep insights...</p>
       </div>
    </div>
  );

  const renderSingleChart = (config: AIChartConfig, data: any[]) => {
    const { type, xKey, yKeys, title, description } = config;
    
    const chart = (() => {
      switch (type) {
        case 'line':
          return (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey={xKey} fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              {yKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={3} dot={{ r: 4 }} />
              ))}
            </LineChart>
          );
        case 'area':
          return (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey={xKey} fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              {yKeys.map((key, i) => (
                <Area key={key} type="monotone" dataKey={key} fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} fillOpacity={0.3} />
              ))}
            </AreaChart>
          );
        case 'pie':
          return (
            <PieChart>
              <Pie data={data} dataKey={yKeys[0]} nameKey={xKey} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                {data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          );
        default:
          return (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey={xKey} fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
              {yKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          );
      }
    })();

    return (
      <div key={title} className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm group hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-sm font-bold text-gray-800">{title}</h4>
            {description && <p className="text-[10px] text-gray-400 font-medium leading-tight mt-1">{description}</p>}
          </div>
          <div className="p-1.5 bg-gray-50 text-gray-400 rounded-lg group-hover:text-blue-500 transition-colors">
            <BarChart3 size={14} />
          </div>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chart}
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-sm">
      <div className="flex border-b border-gray-200 bg-gray-50/50">
        <button
          onClick={() => setTab('report')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all border-b-2 ${
            tab === 'report' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <FileText size={14} /> Report
          {isAnalyzing && <RefreshCw size={10} className="animate-spin text-blue-400" />}
        </button>
        <button
          onClick={() => setTab('viz')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all border-b-2 ${
            tab === 'viz' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <BarChart3 size={14} /> Visualization
          {isRecommendingCharts && <RefreshCw size={10} className="animate-spin text-blue-400" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        {tab === 'report' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight flex items-center gap-2">
                {isAnalyzing ? <RefreshCw size={14} className="text-blue-500 animate-spin" /> : <Sparkles size={14} className="text-blue-500" />}
                AI Analysis Report
              </h2>
              {analysis && <button className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400"><FileOutput size={14} /></button>}
            </div>
            
            {isAnalyzing ? (
              <LoadingCard title="Summarizing Data" icon={RefreshCw} />
            ) : analysis ? (
              <div className="prose prose-sm prose-blue max-w-none">
                <div dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br/>') }} className="text-[13px] leading-relaxed text-gray-600" />
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-gray-300 gap-2 border-2 border-dashed border-gray-100 rounded-2xl">
                <Sparkles size={24} className="opacity-20" />
                <p className="text-xs font-medium">No active analysis</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight flex items-center gap-2">
                {isRecommendingCharts ? <RefreshCw size={14} className="text-blue-500 animate-spin" /> : <Layers size={14} className="text-blue-500" />}
                Visual Recommendations
              </h2>
            </div>
            
            {isRecommendingCharts ? (
              <div className="space-y-4">
                <LoadingCard title="Identifying Patterns" icon={RefreshCw} />
                <LoadingCard title="Rendering Charts" icon={BarChart3} />
              </div>
            ) : result && result.data.length > 0 ? (
              <div className="space-y-6">
                {SI_ENABLE_AI_CHART && result.chartConfigs && result.chartConfigs.length > 0 ? (
                  result.chartConfigs.map(cfg => renderSingleChart(cfg, result.data))
                ) : (
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-4 tracking-widest text-center">Standard View</p>
                    <div className="h-64">
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={result.data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey={result.columns[0]} fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Bar dataKey={result.columns[1]} fill="#2563eb" radius={[4, 4, 0, 0]} />
                         </BarChart>
                       </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-gray-300 gap-2 border-2 border-dashed border-gray-100 rounded-2xl">
                <BarChart3 size={24} className="opacity-20" />
                <p className="text-xs font-medium">No visualization available</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-6 bg-gray-50 border-t border-gray-100">
        <button
          onClick={handleDeploy}
          disabled={isDeploying || !result}
          className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50"
        >
          {isDeploying ? <RefreshCw size={16} className="animate-spin" /> : (deploySuccess ? <CheckCircle2 size={16} /> : <Rocket size={16} />)}
          {deploySuccess ? 'App Deployed!' : 'Publish as Insight App'}
        </button>
      </div>
    </div>
  );
};

export default PublishPanel;
