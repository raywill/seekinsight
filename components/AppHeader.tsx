
import React from 'react';
import { Boxes, LogOut, PencilLine } from 'lucide-react';
import { DevMode } from '../types';

interface Props {
  topicName: string;
  isEditing: boolean;
  tempTopic: string;
  onTempTopicChange: (val: string) => void;
  onEditStart: () => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
  onExit: () => void;
  isNotebookSession: boolean;
  activeMode: DevMode;
  onModeChange: (mode: DevMode) => void;
  hasNewSuggestions?: boolean;
}

const AppHeader: React.FC<Props> = ({
  topicName,
  isEditing,
  tempTopic,
  onTempTopicChange,
  onEditStart,
  onEditSubmit,
  onEditCancel,
  onExit,
  isNotebookSession,
  activeMode,
  onModeChange,
  hasNewSuggestions
}) => {
  const tabs = [
    { id: DevMode.INSIGHT_HUB, label: 'Insight Hub' },
    { id: DevMode.SQL, label: 'SQL Editor' },
    { id: DevMode.PYTHON, label: 'Python Scripting' }
  ];

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-40 shadow-sm shrink-0 relative">
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-4 min-w-[200px]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors" onClick={onExit}>
            <Boxes className="text-white" size={18} />
          </div>
        </div>
        
        <div className="h-5 w-px bg-gray-200"></div>

        <div className="group relative">
          {isEditing ? (
            <input
                autoFocus
                value={tempTopic}
                onChange={e => onTempTopicChange(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') onEditSubmit();
                    if (e.key === 'Escape') onEditCancel();
                }}
                onBlur={onEditSubmit}
                className="bg-gray-50 border border-blue-200 rounded px-2 py-0.5 text-sm font-bold text-gray-800 w-48 outline-none"
            />
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={onEditStart}
            >
              <span className="text-sm font-black text-gray-700 tracking-tight group-hover:text-blue-600 truncate max-w-[200px]">{topicName}</span>
              {!isNotebookSession && (
                 <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded uppercase whitespace-nowrap">App Mode</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center: Tabs */}
      <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 flex items-center gap-1 md:gap-6 h-full">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onModeChange(tab.id)}
            className={`h-full flex items-center relative px-3 text-xs font-black uppercase tracking-wide transition-all border-b-[3px] ${
              activeMode === tab.id 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.id === DevMode.INSIGHT_HUB && hasNewSuggestions && (
              <div className="absolute top-3 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-sm" />
            )}
          </button>
        ))}
      </div>

      {/* Right: Exit */}
      <div className="flex items-center justify-end min-w-[200px]">
        <button 
            onClick={onExit} 
            className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
            <LogOut size={16} />
            <span className="hidden sm:inline">Exit</span>
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
