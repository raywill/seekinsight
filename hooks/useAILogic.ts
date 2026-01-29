
import { DevMode, ProjectState, Suggestion } from '../types';
import * as ai from '../services/aiProvider';
import { UserSettings } from '../components/SettingsModal';

interface AIProps {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
  userSettings: UserSettings;
  activeModeRef: React.MutableRefObject<DevMode>;
  syncSuggestionsToDb: (s: Suggestion[]) => void;
  handleRun: (code?: string, mode?: DevMode) => void;
}

export const useAILogic = ({
  project, setProject, userSettings, activeModeRef, syncSuggestionsToDb, handleRun
}: AIProps) => {

  const handleSqlAiGenerate = async (promptOverride?: string, forceFresh = false) => {
    const promptToUse = promptOverride || project.sqlAiPrompt;
    if (!promptToUse) return;
    
    setProject(prev => ({ ...prev, isSqlAiGenerating: true, lastSqlCodeBeforeAi: prev.sqlCode, sqlAiThought: null }));
    
    try {
      let result;
      const isRefinement = !forceFresh && project.sqlCode && project.sqlCode.length > 20 && !project.sqlCode.trim().startsWith("-- Write SQL here");
      
      if (isRefinement) {
          result = await ai.refineCode(promptToUse, DevMode.SQL, project.tables, project.sqlCode, project.lastSqlResult, project.lastSqlAiPrompt);
      } else {
          result = await ai.generateCode(promptToUse, DevMode.SQL, project.tables);
      }

      setProject(prev => ({ 
          ...prev, 
          sqlCode: result.code, 
          sqlAiThought: result.thought,
          lastSqlAiPrompt: promptToUse,
          isSqlAiGenerating: false 
      }));

      if (userSettings.autoExecute) {
          handleRun(result.code, DevMode.SQL);
      }
    } catch (err) {
      setProject(prev => ({ ...prev, isSqlAiGenerating: false }));
    }
  };

  const handlePythonAiGenerate = async (promptOverride?: string, forceFresh = false) => {
    const promptToUse = promptOverride || project.pythonAiPrompt;
    if (!promptToUse) return;
    
    setProject(prev => ({ ...prev, isPythonAiGenerating: true, lastPythonCodeBeforeAi: prev.pythonCode, pythonAiThought: null }));
    
    try {
      let result;
      const isRefinement = !forceFresh && project.pythonCode && project.pythonCode.length > 20 && !project.pythonCode.trim().startsWith("# Write Python here");

      if (isRefinement) {
          result = await ai.refineCode(promptToUse, DevMode.PYTHON, project.tables, project.pythonCode, project.lastPythonResult, project.lastPythonAiPrompt);
      } else {
          result = await ai.generateCode(promptToUse, DevMode.PYTHON, project.tables);
      }

      setProject(prev => ({ 
          ...prev, 
          pythonCode: result.code, 
          pythonAiThought: result.thought,
          lastPythonAiPrompt: promptToUse,
          isPythonAiGenerating: false 
      }));

      if (userSettings.autoExecute) {
          handleRun(result.code, DevMode.PYTHON);
      }
    } catch (err) {
      setProject(prev => ({ ...prev, isPythonAiGenerating: false }));
    }
  };

  const handleDebugSql = async () => {
    if (!project.sqlCode) return;
    setProject(prev => ({ ...prev, isSqlAiFixing: true, sqlAiThought: null }));
    try {
      const logs = project.lastSqlResult?.logs?.join('\n') || '';
      const { code, thought } = await ai.debugCode(project.sqlAiPrompt, DevMode.SQL, project.tables, project.sqlCode, logs);
      setProject(prev => ({ ...prev, sqlCode: code, sqlAiThought: thought, isSqlAiFixing: false }));
      handleRun(code, DevMode.SQL);
    } catch (err) {
      setProject(prev => ({ ...prev, isSqlAiFixing: false }));
    }
  };

  const handleDebugPython = async () => {
    if (!project.pythonCode) return;
    setProject(prev => ({ ...prev, isPythonAiFixing: true, pythonAiThought: null }));
    try {
      const logs = project.lastPythonResult?.logs?.join('\n') || '';
      const { code, thought } = await ai.debugCode(project.pythonAiPrompt, DevMode.PYTHON, project.tables, project.pythonCode, logs);
      setProject(prev => ({ ...prev, pythonCode: code, pythonAiThought: thought, isPythonAiFixing: false }));
      handleRun(code, DevMode.PYTHON);
    } catch (err) {
      setProject(prev => ({ ...prev, isPythonAiFixing: false }));
    }
  };

  const handleFetchSuggestions = async (setIsSuggesting: (v: boolean) => void, setHasNewSuggestions: (v: boolean) => void) => {
    if (project.tables.length === 0) return;
    setIsSuggesting(true);
    try {
      const newSuggestions = await ai.generateSuggestions(project.tables, project.topicName, project.suggestions);
      const updatedSuggestions = [...project.suggestions, ...newSuggestions];
      setProject(prev => ({ ...prev, suggestions: updatedSuggestions }));
      
      if (activeModeRef.current !== DevMode.INSIGHT_HUB) {
        setHasNewSuggestions(true);
      }

      syncSuggestionsToDb(updatedSuggestions);
    } finally { setIsSuggesting(false); }
  };

  const handleUpdateSuggestion = (id: string, newPrompt: string) => {
    const updated = project.suggestions.map(s => s.id === id ? { ...s, prompt: newPrompt } : s);
    setProject(prev => ({ ...prev, suggestions: updated }));
    syncSuggestionsToDb(updated);
  };

  const handleDeleteSuggestion = (id: string) => {
    const updated = project.suggestions.filter(s => s.id !== id);
    setProject(prev => ({ ...prev, suggestions: updated }));
    syncSuggestionsToDb(updated);
  };

  return {
    handleSqlAiGenerate,
    handlePythonAiGenerate,
    handleDebugSql,
    handleDebugPython,
    handleFetchSuggestions,
    handleUpdateSuggestion,
    handleDeleteSuggestion
  };
};
