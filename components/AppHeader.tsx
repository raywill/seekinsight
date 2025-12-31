
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
  sidebarWidth: number;
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
  hasNewSuggestions,
  sidebarWidth
}) => {
  const tabs = [
    { id: DevMode.INSIGHT_HUB, label: 'Insight Hub' },
    { id: DevMode.SQL, label: 'SQL Editor' },
    { id: DevMode.PYTHON, label: 'Python Scripting' }
  ];

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 z-40 shadow-sm shrink-0 relative transition-all duration-75">
      {/* Left: Logo & Title - Fixed width to match Sidebar (width) minus Header Padding (px-6 = 24px) */}
      <div 
        className="flex items-center gap-4 shrink-0 transition-all duration-75"
        style={{ width: Math.max(200, sidebarWidth - 24) }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors" onClick={onExit}>
            <Boxes className="text-white" size={18} />
          </div>
        </div>
        
        <div className="h-5 w-px bg-gray-200"></div>

        <div className="group relative min-w-0">
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
                className="bg-gray-50 border border-blue-200 rounded px-2 py-0.5 text-sm font-bold text-gray-800 w-full outline-none"
            />
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={onEditStart}
            >
              <span className="text-sm font-black text-gray-700 tracking-tight group-hover:text-blue-600 truncate block">{topicName}</span>
              {!isNotebookSession && (
                 <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded uppercase whitespace-nowrap">App Mode</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center: Tabs - Aligned to start of Editor area with padding */}
      <div className="flex items-center gap-1 md:gap-6 h-full pl-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onModeChange(tab.id)}
            className={`h-full flex items-center pt-2 relative px-3 text-xs font-bold tracking-wide transition-all border-b-[3px] ${
              activeMode === tab.id 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.id === DevMode.INSIGHT_HUB && hasNewSuggestions && (
              <span className="absolute top-3 right-0 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Right: Exit */}
      <div className="flex items-center justify-end min-w-[200px] ml-auto">
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
