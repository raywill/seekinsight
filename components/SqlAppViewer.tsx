
import React, { useState, useEffect, useMemo } from 'react';
import { PublishedApp, DevMode, ExecutionResult, AIChartConfig } from '../types';
import { Play, RefreshCw, Database, BarChart3, FileText, Layers, Sparkles, PencilLine, GitFork, LayoutGrid, MoreVertical } from 'lucide-react';
import SqlResultPanel from './SqlResultPanel';
import * as ai from '../services/aiProvider';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

interface Props {
  app: PublishedApp;
  onClose: () => void;
  onEdit?: (app: PublishedApp) => void;
  onClone?: (app: PublishedApp) => void;
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
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          return (
            <div key={i} className="flex gap-3 items-start pl-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <p className="text-xs text-gray-600 font-medium leading-relaxed">{trimmed.replace(/^[-*]\s*/, '')}</p>
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
              <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length], strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} isAnimationActive={false} />
            ))}
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie data={data} dataKey={yKeys[0]} nameKey={xKey} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} isAnimationActive={false}>
              {data.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<CustomChartTooltip type={type} xKey={xKey} yKeys={yKeys} data={data} />} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
          </PieChart>
        );
      default: 
        const ChartComponent = type === 'area' ? AreaChart : BarChart;
        return (
          <ChartComponent data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey={xKey} fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
            <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
            <Tooltip content={<CustomChartTooltip type={type} xKey={xKey} yKeys={yKeys} data={data} />} />
            {yKeys.map((key, i) => (
              type === 'area' ? 
                <Area key={key} type="monotone" dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} /> :
                <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            ))}
          </ChartComponent>
        );
    }
  })();

  return (
    <div className="bg-white border border-gray-100 rounded-[1.5rem] p-5 space-y-4 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-start shrink-0">
        <div className="max-w-[80%]">
          <h4 className="text-xs font-black text-gray-900 tracking-tight line-clamp-1">{title}</h4>
          {description && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide mt-0.5 line-clamp-1">{description}</p>}
        </div>
        <div className="p-1.5 bg-gray-50 text-blue-500 rounded-lg"><BarChart3 size={12} /></div>
      </div>
      <div className="flex-1 w-full min-h-[160px]"><ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer></div>
    </div>
  );
};

const SqlAppViewer: React.FC<Props> = ({ app, onClose, onEdit, onClone }) => {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [analysisReport, setAnalysisReport] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecommendingCharts, setIsRecommendingCharts] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (app.snapshot_json) {
      try {
        const parsed = JSON.parse(app.snapshot_json);
        if (parsed.result && (parsed.analysis !== undefined || parsed.result.data)) {
            setResult(parsed.result);
            setAnalysisReport(parsed.analysis || '');
        } else {
            setResult(parsed);
        }
      } catch (e) {
        console.error("Failed to parse snapshot", e);
      }
    }
  }, [app]);

  const handleRun = async () => {
    setIsRunning(true);
    const gatewayUrl = (typeof process as any !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';
    
    try {
      // 1. Execute SQL
      const endpoint = '/sql';
      const body = { dbName: app.source_db_name, sql: app.code };

      const res = await fetch(`${gatewayUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      const execResult: ExecutionResult = {
        data: data.rows || [],
        columns: data.columns || [],
        logs: data.logs,
        timestamp: new Date().toLocaleTimeString(),
        isError: !res.ok,
        chartConfigs: result?.chartConfigs // Temporarily keep old charts while new ones load
      };
      
      setResult(execResult);
      setIsRunning(false);

      if (execResult.data.length > 0 && !execResult.isError) {
          // 2. Trigger AI Refresh
          setIsAnalyzing(true);
          setIsRecommendingCharts(true);

          // Parallel AI Calls
          Promise.all([
              ai.generateAnalysis(app.code, execResult.data, app.title).then(report => {
                  setAnalysisReport(report);
                  setIsAnalyzing(false);
              }),
              ai.recommendCharts(app.code, execResult.data).then(charts => {
                  setResult(prev => prev ? ({ ...prev, chartConfigs: charts }) : null);
                  setIsRecommendingCharts(false);
              })
          ]).catch(err => {
              console.error("AI Refresh Failed:", err);
              setIsAnalyzing(false);
              setIsRecommendingCharts(false);
          });
      }

    } catch (e) {
      console.error(e);
      alert("Execution failed. The source database might be offline.");
      setIsRunning(false);
    }
  };

  const handleCloneClick = async () => {
      if (!onClone) return;
      setIsCloning(true);
      try {
          await onClone(app);
      } finally {
          setIsCloning(false);
          setIsMenuOpen(false);
      }
  }

  return (
    <div className="fixed inset-0 z-[150] bg-gray-100 flex items-center justify-center">
      <div className="bg-white w-full h-full flex flex-col animate-in fade-in duration-300">
        
        {/* Fullscreen Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white z-20 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg bg-blue-600 shadow-blue-200">
               <BarChart3 size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 leading-tight">{app.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                 <span className="text-xs font-bold text-gray-400">by {app.author}</span>
                 <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                 <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">{app.type} APP</span>
              </div>
            </div>
          </div>
          <div className="relative">
             <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-900 outline-none"
             >
                <MoreVertical size={20} />
             </button>

             {isMenuOpen && (
               <>
                 <div className="fixed inset-0 z-[40]" onClick={() => setIsMenuOpen(false)} />
                 <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-[50] overflow-hidden p-1.5 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    {app.source_notebook_id && onEdit && (
                        <button 
                           onClick={() => { onEdit(app); setIsMenuOpen(false); }}
                           className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 text-sm font-bold text-gray-700 transition-colors"
                        >
                          <PencilLine size={16} className="text-gray-400" /> Edit
                        </button>
                    )}
                    
                    {onClone && (
                        <button 
                           onClick={handleCloneClick}
                           disabled={isCloning}
                           className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 text-sm font-bold text-gray-700 transition-colors"
                        >
                          {isCloning ? <RefreshCw size={16} className="animate-spin text-blue-500" /> : <GitFork size={16} className="text-gray-400" />} 
                          Clone
                        </button>
                    )}

                    <div className="h-px bg-gray-100 my-1"></div>

                    <button 
                       onClick={onClose} 
                       className="w-full text-left px-4 py-3 hover:bg-red-50 rounded-xl flex items-center gap-3 text-sm font-bold text-gray-700 hover:text-red-600 transition-colors"
                    >
                      <LayoutGrid size={16} className="text-gray-400" /> Marketplace
                    </button>
                 </div>
               </>
             )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar / Controls */}
          <div className="w-80 bg-gray-50 border-r border-gray-100 p-6 flex flex-col overflow-y-auto shrink-0 z-10">
             <div className="mb-8">
               <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Description</h4>
               <p className="text-sm text-gray-600 leading-relaxed font-medium">{app.description || "No description provided."}</p>
             </div>

             <div className="mt-auto">
                <button 
                  onClick={handleRun}
                  disabled={isRunning}
                  className="w-full py-4 rounded-xl text-white font-black shadow-xl transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                >
                  {isRunning ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} />}
                  Run App & Refresh AI
                </button>
                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 uppercase">
                  <Database size={12} /> Source: {app.source_db_name}
                </div>
             </div>
          </div>

          {/* Main Visual Content (Scrollable) + Result Panel (Bottom) */}
          <div className="flex-1 bg-white flex flex-col relative overflow-hidden">
             
             {/* Scrollable Upper Area: Insights + Charts */}
             <div className="flex-1 overflow-y-auto p-8 space-y-10 min-h-0 bg-gray-50/30">
                {/* Analysis Report Section */}
                {(analysisReport || isAnalyzing) && (
                    <div className="max-w-5xl mx-auto animate-in slide-in-from-bottom-2 duration-500">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            {isAnalyzing ? <RefreshCw size={14} className="animate-spin text-blue-500"/> : <Sparkles size={16} className="text-blue-500" />} 
                            Key Strategic Insights
                        </h4>
                        <div className={`bg-white border border-blue-100 p-8 rounded-[2rem] shadow-sm shadow-blue-500/5 ${isAnalyzing ? 'animate-pulse' : ''}`}>
                            {isAnalyzing ? (
                                <div className="space-y-3">
                                    <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                                    <div className="h-4 bg-gray-100 rounded w-full"></div>
                                    <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                                </div>
                            ) : (
                                <SimpleMarkdown content={analysisReport} />
                            )}
                        </div>
                    </div>
                )}

                {/* Charts Area */}
                {(isRecommendingCharts || (result?.chartConfigs && result.chartConfigs.length > 0)) && (
                     <div className="max-w-5xl mx-auto animate-in slide-in-from-bottom-4 duration-700 delay-100">
                         <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            {isRecommendingCharts ? <RefreshCw size={14} className="animate-spin text-blue-500"/> : <Layers size={16} className="text-blue-500" />}
                            Visual Breakdown
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {isRecommendingCharts ? (
                                <>
                                    <div className="h-72 bg-white rounded-[1.5rem] border border-dashed border-gray-200 animate-pulse"></div>
                                    <div className="h-72 bg-white rounded-[1.5rem] border border-dashed border-gray-200 animate-pulse"></div>
                                </>
                            ) : (
                                result?.chartConfigs?.map((cfg, idx) => (
                                    <div key={idx} className="h-72">
                                        <ChartCard config={cfg} rawData={result.data} />
                                    </div>
                                ))
                            )}
                         </div>
                     </div>
                 )}
             </div>

             {/* Result Panel (Fixed at Bottom) */}
             <div className="shrink-0 relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t border-gray-200">
                <SqlResultPanel result={result} isLoading={isRunning} />
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SqlAppViewer;
