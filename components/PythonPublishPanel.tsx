
import React, { useState } from 'react';
import { ExecutionResult } from '../types';
import { Rocket, RefreshCw, Box, ShieldCheck, Activity, Globe, CheckCircle2 } from 'lucide-react';

interface Props {
  result: ExecutionResult | null;
  onDeploy: () => Promise<void>;
  isDeploying: boolean;
}

const PythonPublishPanel: React.FC<Props> = ({ result, onDeploy, isDeploying }) => {
  const [deployed, setDeployed] = useState(false);

  const handleDeploy = async () => {
    await onDeploy();
    setDeployed(true);
    setTimeout(() => setDeployed(false), 3000);
  };

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 bg-purple-50/30 flex items-center justify-between">
        <h2 className="text-[11px] font-black text-purple-700 uppercase tracking-widest flex items-center gap-2">
          <Box size={14} /> Deployment Hub
        </h2>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Environment Context</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Activity, label: 'Runtime', val: 'Python 3.10' },
              { icon: ShieldCheck, label: 'Security', val: 'Venv/Isolated' },
              { icon: Globe, label: 'Endpoint', val: '/api/v1/run' },
              { icon: Box, label: 'Image', val: 'SeekInsight-Core' },
            ].map((item, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-1.5">
                <item.icon size={14} className="text-purple-400" />
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">{item.label}</p>
                  <p className="text-[11px] font-black text-gray-800">{item.val}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Execution Health</h3>
          <div className="p-4 bg-white border border-gray-100 rounded-2xl space-y-3">
             <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Last Run Status</span>
                <span className={`font-black ${result ? 'text-green-600' : 'text-gray-400'}`}>{result ? 'SUCCESS' : 'WAITING'}</span>
             </div>
             <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Memory Usage</span>
                <span className="font-mono text-gray-900 font-bold">124MB</span>
             </div>
          </div>
        </section>

        <div className="p-5 bg-purple-600 rounded-[2rem] text-white space-y-3 shadow-xl shadow-purple-200">
           <h4 className="text-[10px] font-black uppercase tracking-widest opacity-80">Serverless Ready</h4>
           <p className="text-xs font-medium leading-relaxed">This script is optimized for the SeekInsight distributed runtime. You can trigger it via a web-hook once deployed.</p>
        </div>
      </div>

      <div className="p-6 bg-gray-50 border-t border-gray-100">
        <button onClick={handleDeploy} disabled={isDeploying || !result} className="w-full py-4 bg-purple-700 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-3 hover:bg-purple-800 transition-all shadow-lg shadow-purple-100">
          {isDeploying ? <RefreshCw size={18} className="animate-spin" /> : (deployed ? <CheckCircle2 size={18} /> : <Rocket size={18} />)}
          {deployed ? 'SCRIPT DEPLOYED' : 'PUBLISH AS MICROSERVICE'}
        </button>
      </div>
    </div>
  );
};

export default PythonPublishPanel;
