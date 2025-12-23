
import { TableMetadata, DevMode, AppMarketItem } from './types';

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
  { id: '5', name: 'Sentiment Pulse', icon: 'Smile', color: '#EC4899', description: 'NLP-driven analysis of customer support tickets.', author: 'Product Insight', category: 'Customer Success', type: DevMode.PYTHON },
  { id: '6', name: 'Cloud Cost Monitor', icon: 'Cloud', color: '#06B6D4', description: 'Detailed breakdown of multi-cloud infrastructure spending.', author: 'DevOps Central', category: 'IT Ops', type: DevMode.SQL },
  { id: '7', name: 'Ad Campaign ROI', icon: 'Target', color: '#8B5CF6', description: 'Attribution modeling for paid marketing channels.', author: 'Marketing Hub', category: 'Marketing', type: DevMode.SQL },
  { id: '8', name: 'Employee Health Index', icon: 'Activity', color: '#10B981', description: 'Aggregated wellness metrics for large organizations.', author: 'HR Analytics', category: 'HR', type: DevMode.PYTHON },
  { id: '9', name: 'Real Estate Valuator', icon: 'Home', color: '#6366F1', description: 'AI pricing model for urban residential properties.', author: 'PropTech AI', category: 'Real Estate', type: DevMode.PYTHON },
  { id: '10', name: 'Traffic Pattern Lab', icon: 'Map', color: '#F97316', description: 'Visualizing urban mobility using IoT sensor streams.', author: 'Smart City Co', category: 'Public Sector', type: DevMode.SQL },
  { id: '11', name: 'Energy Grid Optimizer', icon: 'Zap', color: '#EAB308', description: 'Forecasting renewable energy output vs demand.', author: 'EcoSystems', category: 'Energy', type: DevMode.PYTHON },
  { id: '12', name: 'Subscription Funnel', icon: 'Filter', color: '#14B8A6', description: 'Visualizing conversion rates from Trial to Pro.', author: 'SaaS Analytics', category: 'Growth', type: DevMode.SQL },
  { id: '13', name: 'Supply Chain Risk', icon: 'AlertTriangle', color: '#991B1B', description: 'Geopolitical risk impact on parts procurement.', author: 'Risk Management', category: 'Logistics', type: DevMode.PYTHON },
  { id: '14', name: 'Content Recommendation', icon: 'Play', color: '#6366F1', description: 'Personalized media ranking for streaming platforms.', author: 'Media Stream', category: 'Tech', type: DevMode.PYTHON },
  { id: '15', name: 'Financial Portfolio', icon: 'Briefcase', color: '#111827', description: 'Asset allocation and risk exposure dashboard.', author: 'Wealth Management', category: 'Finance', type: DevMode.SQL },
  { id: '16', name: 'Network Security Audit', icon: 'Lock', color: '#4B5563', description: 'Automated vulnerability scanning and report generation.', author: 'NetSec', category: 'Security', type: DevMode.PYTHON },
  { id: '17', name: 'Patient Readmission', icon: 'Stethoscope', color: '#2DD4BF', description: 'Predicting hospital readmission risks using EHR data.', author: 'Health Informatics', category: 'Healthcare', type: DevMode.PYTHON },
  { id: '18', name: 'E-commerce Search Analytics', icon: 'Search', color: '#F472B6', description: 'Analysis of zero-result queries and search intent.', author: 'Search Team', category: 'E-commerce', type: DevMode.SQL },
  { id: '19', name: 'Game Retention Monitor', icon: 'Gamepad2', color: '#7C3AED', description: 'Day-7 and Day-30 retention tracking for mobile games.', author: 'Game Studios', category: 'Gaming', type: DevMode.SQL },
  { id: '20', name: 'Logistics Route Pro', icon: 'Truck', color: '#059669', description: 'TSP-based route optimization for delivery fleets.', author: 'Fleet Tech', category: 'Logistics', type: DevMode.PYTHON },
];

export const INITIAL_SQL = `-- Generate some insights\nSELECT region, SUM(amount) as total_revenue\nFROM sales_data\nGROUP BY region\nORDER BY total_revenue DESC;`;

export const INITIAL_PYTHON = `# Python Data Analysis\ndf = sql("SELECT * FROM sales_data LIMIT 10")\nprint("Data Summary:")\nprint(df.describe())\n\n# Visualize with ForgePlot\nforge_plot(df, type='bar')`;
