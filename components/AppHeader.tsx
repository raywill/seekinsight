
import React from 'react';
import { Boxes, LogOut, PencilLine } from 'lucide-react';

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
  isNotebookSession
}) => {
  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 z-20 shadow-sm shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform" onClick={onExit}>
            <Boxes className="text-white" size={20} />
          </div>
          <div><h1 className="font-black text-gray-900 text-lg uppercase tracking-tighter leading-none">SeekInsight</h1></div>
        </div>
        <div className="h-6 w-px bg-gray-100"></div>

        <div className="flex items-center gap-2 group">
          {isEditing ? (
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-blue-200">
              <input
                autoFocus
                value={tempTopic}
                onChange={e => onTempTopicChange(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') onEditSubmit();
                    if (e.key === 'Escape') onEditCancel();
                }}
                onBlur={onEditSubmit}
                className="bg-transparent border-none outline-none text-sm font-bold text-gray-800 px-2 w-48"
              />
            </div>
          ) : (
            <div
              className="flex items-center gap-2 px-4 py-2 bg-gray-50/50 hover:bg-gray-100/80 rounded-xl cursor-pointer transition-all border border-transparent hover:border-gray-200"
              onClick={onEditStart}
            >
              <span className="text-sm font-black text-gray-700 tracking-tight">{topicName}</span>
              {!isNotebookSession && (
                 <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded uppercase">App Session</span>
              )}
              <PencilLine size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={onExit} className="w-9 h-9 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
      </div>
    </header>
  );
};

export default AppHeader;
