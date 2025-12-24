
import React, { useState, useMemo } from 'react';
import { ExecutionResult, AIChartConfig } from '../types';
import { FileText, BarChart3, Rocket, RefreshCw, Sparkles, CheckCircle2, Layers } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

interface Props {
  result: ExecutionResult | null;
  analysis: string;
  isAnalyzing: boolean;
  isRecommendingCharts: boolean;
  onDeploy: () => Promise<void>;
  isDeploying: boolean;
}

// Professional High-Contrast Palette for Data Visualization
const CHART_COLORS = [
  '#2563eb', // Blue 600
  '#10b981', // Emerald 500
  '#f59e0b', // Amber 500
  '#8b5cf6', // Violet 500
  '#ef4444', // Red 500
  '#06b6d4', // Cyan 500
  '#f43f5e', // Rose 500
  '#64748b', // Slate 500
];

const processChartData = (data: any[], xKey: string, yKeys: string[], limitOthers: boolean = false) => {
  if (!data || data.length === 0) return [];
  const aggregatedMap: Record<string, any> = {};
  data.forEach(row => {
    const category = String(row[xKey] ?? 'Unknown');
    if (!aggregatedMap[category]) {
      aggregatedMap[category] = { [xKey]: category };
      yKeys.forEach(yk => aggregatedMap[category][yk] = 0);
    }
    yKeys.forEach(yk => {
      aggregatedMap[category][yk] += (Number(row[yk]) || 0);
    });
  });

  let resultData = Object.values(aggregatedMap);

  if (limitOthers) {
    const primaryMetric = yKeys[0];
    resultData.sort((a, b) => (Number(b[primaryMetric]) || 0) - (Number(a[primaryMetric]) || 0));
    if (resultData.length > 7) {
      const top = resultData.slice(0, 6);
      const rest = resultData.slice(6);
      const othersObj: any = { [xKey]: 'Others' };
      yKeys.forEach(yk => {
        othersObj[yk] = rest.reduce((sum, item) => sum + (Number(item[yk]) || 0), 0);
      });
      return [...top, othersObj];
    }
  }
  return resultData;
};

const CustomChartTooltip = ({ active, payload, label, type, xKey, yKeys, data }: any) => {
  if (active && payload && payload.length) {
    const tooltipTitle = type === 'pie' ? payload[0].payload[xKey] : (label || payload[0].payload[xKey]);
    const total = type === 'pie' && data ? data.reduce((s: number, c: any) => s + (Number(c[yKeys[0]]) || 0), 0) : 0;
    
    return (
      <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl min-w-[140px]">
        <p className="text-xs font-black text-gray-900 mb-2 border-b border-gray-50 pb-1">{tooltipTitle}</p>
        <div className="space-y-1.5">
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-4 justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }}></div>
                <span className="text-[10px] font-bold text-gray-500 uppercase">{p.dataKey}:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-black text-blue-600">{Number(p.value).toLocaleString()}</span>
                {type === 'pie' && total > 0 && (
                  <span className="text-[9px] font-bold text-gray-400">({((p.value / total) * 100).toFixed(1)}%)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const ChartCard: React.FC<{ config: AIChartConfig; rawData: any[] }> = ({ config, rawData }) => {
  const { type, xKey, yKeys, title, description } = config;
  const data = useMemo(() => processChartData(rawData, xKey, yKeys, type === 'pie'), [rawData, xKey, yKeys, type]);

  const chart = (() => {
    switch (type) {
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey={xKey} fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
            <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
            <Tooltip content={<CustomChartTooltip type={type} xKey={xKey} yKeys={yKeys} data={data} />} />
            {yKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS[i % CHART_COLORS.length], strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            ))}
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey={xKey} fontSize={10} axisLine={false} tickLine={false} />
            <YAxis fontSize={10} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomChartTooltip type={type} xKey={xKey} yKeys={yKeys} data={data} />} />
            {yKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.2} strokeWidth={2} />
            ))}
          </AreaChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={yKeys[0]}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={4}
              animationDuration={1000}
            >
              {data.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />)}
            </Pie>
            <Tooltip content={<CustomChartTooltip type={type} xKey={xKey} yKeys={yKeys} data={data} />} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} />
          </PieChart>
        );
      default: // bar
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey={xKey} fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
            <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
            <Tooltip content={<CustomChartTooltip type={type} xKey={xKey} yKeys={yKeys} data={data} />} />
            {yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        );
    }
  })();

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm group hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-sm font-black text-gray-800 tracking-tight">{title}</h4>
          {description && <p className="text-[10px] text-gray-400 font-bold leading-tight mt-1 uppercase tracking-wide">{description}</p>}
        </div>
        <div className="p-1.5 bg-gray-50 text-gray-400 rounded-lg group-hover:text-blue-500 transition-colors">
          <BarChart3 size={14} />
        </div>
      </div>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const SqlPublishPanel: React.FC<Props> = ({ result, analysis, isAnalyzing, isRecommendingCharts, onDeploy, isDeploying }) => {
  const [tab, setTab] = useState<'report' | 'viz'>('report');
  const [deployed, setDeployed] = useState(false);

  const handleDeploy = async () => {
    await onDeploy();
    setDeployed(true);
    setTimeout(() => setDeployed(false), 3000);
  };

  const LoadingCard = ({ title, icon: Icon }: { title: string, icon: any }) => (
    <div className="bg-white border border-dashed border-blue-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 animate-pulse">
       <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
          <Icon className="animate-spin" size={18} />
       </div>
       <div>
         <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</h4>
       </div>
    </div>
  );

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

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
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
              <div className="h-32 flex flex-col items-center justify-center text-gray-300 gap-2 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
                <Sparkles size={20} className="opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Analysis</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Layers size={14} className="text-blue-500" /> Intelligent Visuals
            </h2>
            
            {isRecommendingCharts ? (
              <div className="space-y-4">
                <LoadingCard title="Clustering Categories" icon={RefreshCw} />
                <LoadingCard title="Optimizing Layout" icon={BarChart3} />
              </div>
            ) : result && result.data.length > 0 ? (
              <div className="space-y-6">
                {result.chartConfigs && result.chartConfigs.length > 0 ? (
                  result.chartConfigs.map((cfg, idx) => (
                    <ChartCard key={`${cfg.title}-${idx}`} config={cfg} rawData={result.data} />
                  ))
                ) : (
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] text-gray-400 font-black uppercase mb-4 tracking-widest text-center">Summary Statistics</p>
                    <div className="h-52">
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={processChartData(result.data, result.columns[0], [result.columns[1]])}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey={result.columns[0]} fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                            <Tooltip content={<CustomChartTooltip type="bar" xKey={result.columns[0]} yKeys={[result.columns[1]]} />} />
                            <Bar dataKey={result.columns[1]} fill="#2563eb" radius={[4, 4, 0, 0]} />
                         </BarChart>
                       </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-gray-300 gap-2 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
                <BarChart3 size={24} className="opacity-20 mb-2" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-center">No Visual Data</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-6 bg-gray-50 border-t border-gray-100">
        <button onClick={handleDeploy} disabled={isDeploying || !result} className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50 active:scale-[0.98]">
          {isDeploying ? <RefreshCw size={16} className="animate-spin" /> : (deployed ? <CheckCircle2 size={16} /> : <Rocket size={16} />)}
          {deployed ? 'SUCCESSFULLY PUBLISHED' : 'DEPLOY REPORT APP'}
        </button>
      </div>
    </div>
  );
};

export default SqlPublishPanel;
