
import React, { useState, useMemo } from 'react';
import { ExecutionResult, AIChartConfig, DevMode } from '../types';
import { FileText, BarChart3, Rocket, RefreshCw, Sparkles, CheckCircle2, Layers, AlertCircle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

interface Props {
  result: ExecutionResult | null;
  analysis: string;
  isAnalyzing: boolean;
  isRecommendingCharts: boolean;
  onDeploy: () => void;
  isDeploying: boolean;
  width: number;
}

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f43f5e', '#64748b'];

const processChartData = (data: any[], xKey: string, yKeys: string[], limitOthers: boolean = false) => {
  if (!data || data.length === 0 || !xKey) return [];
  const aggregatedMap: Record<string, any> = {};
  
  data.forEach(row => {
    const category = String(row[xKey] ?? 'N/A');
    if (!aggregatedMap[category]) {
      aggregatedMap[category] = { [xKey]: category };
      yKeys.forEach(yk => { if (yk) aggregatedMap[category][yk] = 0; });
    }
    yKeys.forEach(yk => {
      if (yk && row[yk] !== undefined) {
        aggregatedMap[category][yk] += (Number(row[yk]) || 0);
      }
    });
  });

  let resultData = Object.values(aggregatedMap);
  if (limitOthers && yKeys[0]) {
    const primaryMetric = yKeys[0];
    resultData.sort((a: any, b: any) => (Number(b[primaryMetric]) || 0) - (Number(a[primaryMetric]) || 0));
    if (resultData.length > 7) {
      const top = resultData.slice(0, 6);
      const rest = resultData.slice(6);
      const othersObj: any = { [xKey]: 'Others' };
      yKeys.forEach(yk => {
        othersObj[yk] = rest.reduce((sum, item: any) => sum + (Number(item[yk]) || 0), 0);
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
        <p className="text-[11px] font-black text-gray-900 mb-2 border-b border-gray-50 pb-1 truncate">{tooltipTitle}</p>
        <div className="space-y-1.5">
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-4 justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color || p.fill }}></div>
                <span className="text-[9px] font-bold text-gray-400 uppercase">{p.dataKey}:</span>
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

const SimpleMarkdown = ({ content }: { content: string }) => {
  if (!content) return null;
  const lines = content.split('\n');
  return (
    <div className="space-y-4">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('###')) return <h3 key={i} className="text-sm font-black text-gray-900 mt-6 mb-2 uppercase tracking-tight">{trimmed.replace(/^###\s*/, '')}</h3>;
        if (trimmed.startsWith('##')) return <h2 key={i} className="text-base font-black text-gray-900 mt-8 mb-3 border-b border-gray-100 pb-1">{trimmed.replace(/^##\s*/, '')}</h2>;
        
        // Strict list check: must start with - or * followed by a space.
        if (trimmed.match(/^[-*]\s/)) {
          return (
            <div key={i} className="flex gap-3 items-start pl-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <p className="text-xs text-gray-600 font-medium leading-relaxed">{trimmed.replace(/^[-*]\s+/, '')}</p>
            </div>
          );
        }
        if (!trimmed) return <div key={i} className="h-2" />;
        
        const formattedLine = trimmed.replace(/\*\*(.*?)\*\*/g, '<b class="font-black text-gray-800">$1</b>');
        return <p key={i} className="text-xs text-gray-600 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedLine }} />;
      })}
    </div>
  );
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
              <Line 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={CHART_COLORS[i % CHART_COLORS.length]} 
                strokeWidth={2.5} 
                dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length], strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 5 }} 
                isAnimationActive={false}
              />
            ))}
          </LineChart>
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
              innerRadius={50} 
              outerRadius={70} 
              paddingAngle={3}
              isAnimationActive={false}
            >
              {data.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<CustomChartTooltip type={type} xKey={xKey} yKeys={yKeys} data={data} />} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
          </PieChart>
        );
      default: // bar and area
        const ChartComponent = type === 'area' ? AreaChart : BarChart;
        return (
          <ChartComponent data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey={xKey} fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
            <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
            <Tooltip content={<CustomChartTooltip type={type} xKey={xKey} yKeys={yKeys} data={data} />} />
            {yKeys.map((key, i) => (
              type === 'area' ? 
                <Area 
                  key={key} 
                  type="monotone" 
                  dataKey={key} 
                  fill={CHART_COLORS[i % CHART_COLORS.length]} 
                  stroke={CHART_COLORS[i % CHART_COLORS.length]} 
                  fillOpacity={0.15} 
                  strokeWidth={2} 
                  isAnimationActive={false}
                /> :
                <Bar 
                  key={key} 
                  dataKey={key} 
                  fill={CHART_COLORS[i % CHART_COLORS.length]} 
                  radius={[3, 3, 0, 0]} 
                  isAnimationActive={false}
                />
            ))}
          </ChartComponent>
        );
    }
  })();

  return (
    <div className="bg-white border border-gray-100 rounded-[1.5rem] p-5 space-y-4 shadow-sm">
      <div className="flex justify-between items-start">
        <div className="max-w-[80%]">
          <h4 className="text-xs font-black text-gray-900 tracking-tight line-clamp-1">{title}</h4>
          {description && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide mt-0.5 line-clamp-1">{description}</p>}
        </div>
        <div className="p-1.5 bg-gray-50 text-blue-500 rounded-lg"><BarChart3 size={12} /></div>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
      </div>
    </div>
  );
};

const SqlPublishPanel: React.FC<Props> = ({ result, analysis, isAnalyzing, isRecommendingCharts, onDeploy, isDeploying, width }) => {
  const [tab, setTab] = useState<'report' | 'viz'>('viz');
  const hasData = result && result.data && result.data.length > 0;

  return (
    <div 
      className="bg-white border-l border-gray-100 flex flex-col h-full shadow-2xl shadow-black/5 shrink-0"
      style={{ width }}
    >
      <div className="flex border-b border-gray-100 bg-white">
        <button 
          onClick={() => setTab('viz')} 
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${tab === 'viz' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          <BarChart3 size={14} /> CHART
          {isRecommendingCharts && <RefreshCw size={10} className="animate-spin" />}
        </button>
        <button 
          onClick={() => setTab('report')} 
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${tab === 'report' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          <FileText size={14} /> Report
          {isAnalyzing && <RefreshCw size={10} className="animate-spin" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {tab === 'viz' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Layers size={14} className="text-blue-500" />
                Intelligent Visuals
              </h2>
              {hasData && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[9px] font-bold">
                  <TrendingUp size={10} /> {result.data.length} Records
                </div>
              )}
            </div>
            
            {isRecommendingCharts ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="bg-white border border-dashed border-gray-200 rounded-[1.5rem] p-8 flex flex-col items-center justify-center animate-pulse">
                    <RefreshCw size={24} className="text-blue-200 animate-spin mb-3" />
                    <div className="h-2 w-24 bg-gray-50 rounded" />
                  </div>
                ))}
              </div>
            ) : hasData ? (
              <div className="space-y-6">
                {result.chartConfigs && result.chartConfigs.length > 0 ? (
                  result.chartConfigs.map((cfg, idx) => (
                    <ChartCard key={idx} config={cfg} rawData={result.data} />
                  ))
                ) : (
                  result.columns && result.columns.length >= 2 ? (
                    <ChartCard 
                      config={{ type: 'bar', xKey: result.columns[0], yKeys: [result.columns[1]], title: 'Quick Summary' }} 
                      rawData={result.data} 
                    />
                  ) : (
                    <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100">
                      <AlertCircle size={24} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Insufficient columns for charting</p>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-[2rem]">
                <BarChart3 size={32} className="opacity-10 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Results</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Sparkles size={14} className="text-blue-500" /> Executive Report
            </h2>
            {isAnalyzing ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-5/6" />
                <div className="h-3 bg-gray-100 rounded w-4/6" />
                <div className="pt-4 h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ) : analysis ? (
              <SimpleMarkdown content={analysis} />
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-[2rem]">
                <FileText size={32} className="opacity-10 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">No Analysis Generated</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-6 bg-white border-t border-gray-100">
        <button 
          onClick={onDeploy} 
          disabled={isDeploying || !hasData} 
          className="w-full py-4 bg-gray-900 text-white rounded-[1.25rem] text-sm font-black flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50 active:scale-95"
        >
          <Rocket size={18} />
          PUBLISH AS DASHBOARD
        </button>
      </div>
    </div>
  );
};

export default SqlPublishPanel;
