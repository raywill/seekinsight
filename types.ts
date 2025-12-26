
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
  isError?: boolean;
}

export interface Suggestion {
  id: string;
  title: string;
  prompt: string;
  category: string;
  type: DevMode.SQL | DevMode.PYTHON;
}

export interface PublishedApp {
  id: string;
  title: string;
  description: string;
  author: string;
  type: DevMode.SQL | DevMode.PYTHON;
  code: string;
  source_db_name: string;
  source_notebook_id?: string; // Link to original notebook
  params_schema?: string; // JSON string
  snapshot_json?: string; // JSON string of ExecutionResult
  created_at: string;
  // UI helper for Market display
  icon?: string; 
  color?: string;
  category?: string;
}

// Deprecated in favor of PublishedApp, but kept for compatibility if needed
export interface AppMarketItem extends PublishedApp {}

export interface Notebook {
  id: string;
  db_name: string;
  topic: string;
  user_id: number;
  icon_name: string;
  suggestions_json?: string;
  created_at: string;
}

export interface ProjectState {
  id: string | null;
  dbName: string | null;
  name: string;
  topicName: string;
  owner: string;
  tables: TableMetadata[];
  activeMode: DevMode;
  sqlCode: string;
  pythonCode: string;
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
  isSqlAiGenerating: boolean;
  isSqlAiFixing: boolean;
  isPythonAiGenerating: boolean;
  isPythonAiFixing: boolean;
  analysisReport: string;
  visualConfig: {
    chartType: 'bar' | 'line' | 'pie';
  };
}
