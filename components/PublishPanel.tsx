
import React, { useState, useMemo } from 'react';
import { DevMode, ExecutionResult } from '../types';
import { FileText, BarChart3, Rocket, CheckCircle2, LayoutDashboard, Settings2, FileOutput, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

interface Props {
  mode: DevMode;
  result: ExecutionResult | null;
  analysis: string;
  onDeploy: () => Promise<void>;
  isDeploying: boolean;
}

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#1d4ed8', '#1e40af'];

const PublishPanel: React.FC<Props> = ({ mode, result, analysis, onDeploy, isDeploying }) => {
  const [tab, setTab] = useState<'report' | 'viz'>('report');
  const [chartType, setChartType] = useState<'Bar' | 'Line' | 'Pie'>('Bar');
  const [deploySuccess, setDeploySuccess] = useState(false);

  const handleDeploy = async () => {
    await onDeploy();
    setDeploySuccess(true);
    setTimeout(() => setDeploySuccess(false), 3000);
  };

  // Helper to find numeric and categorical keys and sanitize data
  const chartProps = useMemo(() => {
    if (!result || result.data.length === 0) return null;

    // Identify first numeric column for Y-axis
    const numericKey = result.columns.find(col => 
      result.data.some(row => {
        const val = row[col];
        return typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(val));
      })
    ) || result.columns[1] || result.columns[0];

    // Identify X-axis key (usually the first column that isn't the Y-axis key)
    const categoryKey = result.columns.find(col => col !== numericKey) || result.columns[0];

    // Sanitize data: Ensure metric is always numeric for Recharts
    const data = result.data.map(row => ({
      ...row,
      [numericKey]: parseFloat(row[numericKey]) || 0
    })).filter(row => row[numericKey] !== undefined);

    return { data, xKey: categoryKey, yKey: numericKey };
  }, [result]);

  const renderChart = () => {
    if (!chartProps) return null;
    const { data, xKey, yKey } = chartProps;

    switch (chartType) {
      case 'Line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey={xKey} fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              />
              <Line type="monotone" dataKey={yKey} stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'Pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [value.toLocaleString(), 'Value']}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey={xKey} fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              />
              <Bar dataKey={yKey} fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  if (mode === DevMode.PYTHON) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <LayoutDashboard size={16} className="text-purple-600" />
            App Deployment
          </h2>
        </div>
        <div className="p-6 flex flex-col gap-6">
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
              <h3 className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-1">Status</h3>
              <p className="text-sm text-purple-900 font-medium">Ready for cloud deployment</p>
            </div>
            
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-gray-500 uppercase">Project Endpoint</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-600 truncate">
                https://api.forge.io/v1/app_0x3f...
              </div>
            </div>

            <button
              onClick={handleDeploy}
              disabled={isDeploying || deploySuccess}
              className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-md active:scale-95 ${
                deploySuccess 
                ? 'bg-green-600 text-white' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {isDeploying ? (
                <CheckCircle2 size={18} className="animate-pulse" />
              ) : deploySuccess ? (
                <CheckCircle2 size={18} />
              ) : (
                <Rocket size={18} />
              )}
              {isDeploying ? 'Deploying...' : deploySuccess ? 'Deployed Successfully!' : 'Push to Production'}
            </button>
          </div>

          <div className="p-4 border border-gray-100 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2 uppercase">
              <Settings2 size={12} />
              Configurations
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Instance Size</span>
                <span className="font-medium text-gray-700">Small (2 vCPU)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Auto-Scaling</span>
                <span className="font-medium text-green-600">Enabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-sm">
      <div className="flex border-b border-gray-200 bg-gray-50/50">
        <button
          onClick={() => setTab('report')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all border-b-2 ${
            tab === 'report' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <FileText size={14} />
          Report
        </button>
        <button
          onClick={() => setTab('viz')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all border-b-2 ${
            tab === 'viz' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <BarChart3 size={14} />
          Visualization
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'report' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight">AI Analysis</h2>
              <button className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-400" title="Export PDF">
                <FileOutput size={14} />
              </button>
            </div>
            {analysis ? (
              <div className="prose prose-sm prose-blue max-w-none">
                <div dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br/>') }} className="text-[13px] leading-relaxed text-gray-600" />
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-gray-300 gap-2 border-2 border-dashed border-gray-100 rounded-2xl">
                <Sparkles size={24} className="opacity-20" />
                <p className="text-xs font-medium">No results to analyze yet</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Real-time Preview</h2>
            </div>
            {result && chartProps ? (
              <div className="flex-1 space-y-8">
                <div className="h-72 bg-white rounded-xl">
                  {renderChart()}
                </div>

                <div className="p-4 bg-gray-50 rounded-xl space-y-4">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Controls</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {['Bar', 'Line', 'Pie'].map(type => (
                      <button 
                        key={type} 
                        onClick={() => setChartType(type as any)}
                        className={`py-2 text-[10px] font-bold border rounded-lg transition-all shadow-sm uppercase ${
                          chartType === type 
                            ? 'bg-blue-600 border-blue-600 text-white' 
                            : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-500'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-gray-300 gap-2 border-2 border-dashed border-gray-100 rounded-2xl">
                <BarChart3 size={24} className="opacity-20" />
                <p className="text-xs font-medium">Connect data to visualize</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublishPanel;
