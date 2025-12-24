
export enum DevMode {
  SQL = 'SQL',
  PYTHON = 'PYTHON',
  INSIGHT_HUB = 'INSIGHT_HUB'
}

export interface Column {
  name: string;
  type: string;
  comment: string;
}

export interface TableMetadata {
  id: string;
  tableName: string;
  columns: Column[];
  rowCount: number;
}

export interface AIChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area';
  xKey: string;
  yKeys: string[];
  title: string;
  description?: string;
}

export interface ExecutionResult {
  data: any[];
  columns: string[];
  logs?: string[];
  plotlyData?: any;
  chartConfigs?: AIChartConfig[]; 
  timestamp: string;
}

export interface Suggestion {
  id: string;
  title: string;
  prompt: string;
  category: string;
  type: DevMode.SQL | DevMode.PYTHON;
}

export interface AppMarketItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  author: string;
  category: string;
  type: DevMode.SQL | DevMode.PYTHON;
}

export interface ProjectState {
  name: string;
  owner: string;
  tables: TableMetadata[];
  activeMode: DevMode;
  sqlCode: string;
  pythonCode: string;
  // History for Undo
  lastSqlCodeBeforeAi: string | null;
  lastPythonCodeBeforeAi: string | null;
  sqlAiPrompt: string;
  pythonAiPrompt: string;
  suggestions: Suggestion[];
  lastSqlResult: ExecutionResult | null;
  lastPythonResult: ExecutionResult | null;
  isExecuting: boolean;
  isAnalyzing: boolean;
  isRecommendingCharts: boolean;
  isDeploying: boolean;
  // AI Generation Status
  isSqlAiGenerating: boolean;
  isPythonAiGenerating: boolean;
  analysisReport: string;
  visualConfig: {
    chartType: 'bar' | 'line' | 'pie';
  };
}
