
export enum DevMode {
  SQL = 'SQL',
  PYTHON = 'PYTHON'
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

export interface ExecutionResult {
  data: any[];
  columns: string[];
  logs?: string[];
  timestamp: string;
}

export interface AppMarketItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  author: string;
  category: string;
  type: DevMode;
}

export interface ProjectState {
  name: string;
  owner: string;
  tables: TableMetadata[];
  activeMode: DevMode;
  sqlCode: string;
  pythonCode: string;
  lastResult: ExecutionResult | null;
  isExecuting: boolean;
  isDeploying: boolean;
  analysisReport: string;
  visualConfig: {
    chartType: 'bar' | 'line' | 'pie';
  };
}
