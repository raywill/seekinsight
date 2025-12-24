
import { TableMetadata, DevMode, AppMarketItem } from './types';

// Global Feature Toggles
export const SI_ENABLE_AI_CHART = true; 

export const DEFAULT_TABLES: TableMetadata[] = [
  {
    id: '1',
    tableName: 'sales_data',
    rowCount: 12500,
    columns: [
      { name: 'date', type: 'DATE', comment: 'Transaction date' },
      { name: 'amount', type: 'FLOAT', comment: 'Total sales amount' },
      { name: 'region', type: 'STRING', comment: 'Geographic region' },
      { name: 'product_id', type: 'INT', comment: 'Unique product identifier' }
    ]
  },
  {
    id: '2',
    tableName: 'user_profiles',
    rowCount: 5000,
    columns: [
      { name: 'user_id', type: 'INT', comment: 'Primary key' },
      { name: 'signup_date', type: 'DATE', comment: 'User registration date' },
      { name: 'segment', type: 'STRING', comment: 'User marketing segment' }
    ]
  }
];

export const MOCK_APPS: AppMarketItem[] = [
  { id: '1', name: 'Global Sales Forecast', icon: 'TrendingUp', color: '#3B82F6', description: 'Predicts regional sales trends using historical CRM data.', author: 'DataTeam Alpha', category: 'Finance', type: DevMode.SQL },
  { id: '2', name: 'User Churn Analyzer', icon: 'UserMinus', color: '#EF4444', description: 'Identifies high-risk segments based on engagement logs.', author: 'Growth Ops', category: 'Marketing', type: DevMode.PYTHON },
  { id: '3', name: 'Inventory Optimizer', icon: 'Box', color: '#F59E0B', description: 'Dynamic stock level monitoring for multi-warehouse setups.', author: 'SupplyChain Pro', category: 'Logistics', type: DevMode.SQL },
  { id: '4', name: 'Fraud Detection Engine', icon: 'ShieldAlert', color: '#DC2626', description: 'Anomaly detection for real-time transaction processing.', author: 'Security Lab', category: 'Finance', type: DevMode.PYTHON },
];

export const INITIAL_SQL = `-- Generate some insights\nSELECT region, SUM(amount) as total_revenue\nFROM sales_data\nGROUP BY region\nORDER BY total_revenue DESC;`;

export const INITIAL_PYTHON = `# Python Data Analysis\ndf = sql("SELECT * FROM sales_data LIMIT 10")\nprint("Data Summary:")\nprint(df.describe())\n\n# Visualize with ForgePlot\nforge_plot(df, type='bar')`;
