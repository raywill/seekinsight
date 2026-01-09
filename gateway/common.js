
import path from 'path';
import fs from 'fs';

export const PORT = 3001;
export const IS_DEBUG = process.env.SI_DEBUG_MODE !== 'false';
export const VENV_PATH = path.join(process.cwd(), '.venv');
export const VENV_PYTHON = process.platform === 'win32' 
  ? path.join(VENV_PATH, 'Scripts', 'python.exe') 
  : path.join(VENV_PATH, 'bin', 'python');
export const LOCK_FILE = path.join(process.cwd(), '.init_lock');

// Database Configuration
export const DB_TYPE = process.env.DB_TYPE || 'mysql'; // 'mysql', 'postgres', 'sqlite'
export const MASTER_DB = 'seekinsight_datasets';
export const SYSTEM_DB = 'seekinsight';

// MySQL Config
export const MYSQL_CONFIG = {
  host: process.env.MYSQL_IP || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || ''
};

// Postgres Config
export const PG_URL = process.env.PG_URL;
export const PG_CONFIG = {
  host: process.env.PG_HOST || '127.0.0.1',
  port: parseInt(process.env.PG_PORT || '5432'),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres'
};

export function getPythonExecutable() {
  if (fs.existsSync(VENV_PYTHON)) {
    return VENV_PYTHON;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

export const NOTEBOOK_LIST_TABLE = 'seekinsight_notebook_list';
export const PUBLISHED_APPS_TABLE = 'seekinsight_published_apps';
export const SHARE_SNAPSHOTS_TABLE = 'seekinsight_share_snapshots';
export const USER_SETTINGS_TABLE = 'seekinsight_user_settings';

export const DATASETS = [
  {
    id: 'retail',
    name: 'Retail / E-commerce',
    description: 'Orders, products, and customer data for sales analysis.',
    icon: 'ShoppingCart',
    color: 'text-orange-500',
    fileName: 'retail.md',
    prefix: 'retail',
    topicName: 'Quarterly Sales Review'
  },
  {
    id: 'hr',
    name: 'HR / Workforce',
    description: 'Employee demographics, departments, and salary history.',
    icon: 'Users',
    color: 'text-blue-500',
    fileName: 'hr.md',
    prefix: 'hr',
    topicName: 'Workforce Demographics'
  },
  {
    id: 'movies',
    name: 'Movies & Reviews',
    description: 'Movie database with user reviews for sentiment analysis.',
    icon: 'Film',
    color: 'text-purple-500',
    fileName: 'movies.md',
    prefix: 'movies',
    topicName: 'Content Sentiment Analysis'
  },
  {
    id: 'saas',
    name: 'SaaS Metrics',
    description: 'Subscription logs and daily active user counts.',
    icon: 'Activity',
    color: 'text-green-500',
    fileName: 'saas.md',
    prefix: 'saas',
    topicName: 'Churn & Growth Metrics'
  }
];
