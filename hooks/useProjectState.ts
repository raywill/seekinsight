
import { useState, useEffect, useRef } from 'react';
import { ProjectState, Notebook, DevMode, Dataset } from '../types';
import { INITIAL_SQL, INITIAL_PYTHON } from '../constants';
import { UserSettings } from '../components/SettingsModal';

const USER_ID = '0';

export const useProjectState = (gatewayUrl: string) => {
  const [currentNotebook, setCurrentNotebook] = useState<Notebook | null>(null);
  const [dbReady, setDbReady] = useState(false);
  const [availableDatasets, setAvailableDatasets] = useState<Dataset[]>([]);
  
  const [userSettings, setUserSettings] = useState<UserSettings>({ autoExecute: false });

  const [project, setProject] = useState<ProjectState>({
    id: null,
    dbName: null,
    name: "Enterprise Data Hub",
    topicName: "未命名主题",
    derivedAppTitle: null,
    owner: "Lead Analyst",
    tables: [],
    activeMode: DevMode.SQL,
    sqlCode: INITIAL_SQL,
    pythonCode: INITIAL_PYTHON,
    lastSqlCodeBeforeAi: null,
    lastPythonCodeBeforeAi: null,
    sqlAiPrompt: '',
    pythonAiPrompt: '',
    lastSqlAiPrompt: null,
    lastPythonAiPrompt: null,
    sqlAiThought: null,
    pythonAiThought: null,
    suggestions: [],
    lastSqlResult: null,
    lastPythonResult: null,
    previewResult: null,
    isExecuting: false,
    isAnalyzing: false,
    isRecommendingCharts: false,
    isDeploying: false,
    isSqlAiGenerating: false,
    isSqlAiFixing: false,
    isPythonAiGenerating: false,
    isPythonAiFixing: false,
    analysisReport: '',
    visualConfig: { chartType: 'bar' }
  } as ProjectState);

  // Track activeMode in ref to avoid stale closures in async callbacks
  const activeModeRef = useRef(project.activeMode);
  useEffect(() => {
    activeModeRef.current = project.activeMode;
  }, [project.activeMode]);

  // Load Settings on Mount
  useEffect(() => {
      fetch(`${gatewayUrl}/settings/${USER_ID}`)
        .then(res => res.json())
        .then(data => setUserSettings(data))
        .catch(console.error);
  }, [gatewayUrl]);

  const updateUserSettings = async (key: keyof UserSettings, value: boolean) => {
    const newSettings = { ...userSettings, [key]: value };
    setUserSettings(newSettings);
    try {
        await fetch(`${gatewayUrl}/settings/${USER_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSettings)
        });
    } catch(e) {
        console.error("Failed to save settings", e);
    }
  };

  return {
    project, setProject,
    currentNotebook, setCurrentNotebook,
    dbReady, setDbReady,
    availableDatasets, setAvailableDatasets,
    userSettings, updateUserSettings,
    activeModeRef
  };
};
