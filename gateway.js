
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 3001;
const IS_DEBUG = process.env.SI_DEBUG_MODE !== 'false';
const VENV_PATH = path.join(process.cwd(), '.venv');
const VENV_PYTHON = process.platform === 'win32' 
  ? path.join(VENV_PATH, 'Scripts', 'python.exe') 
  : path.join(VENV_PATH, 'bin', 'python');
const LOCK_FILE = path.join(process.cwd(), '.init_lock');

function getPythonExecutable() {
  if (fs.existsSync(VENV_PYTHON)) {
    return VENV_PYTHON;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

const SYSTEM_DB = 'seekinsight';
const MASTER_DATASET_DB = 'seekinsight_datasets';
const NOTEBOOK_LIST_TABLE = 'seekinsight_notebook_list';
const PUBLISHED_APPS_TABLE = 'seekinsight_published_apps';
const SHARE_SNAPSHOTS_TABLE = 'seekinsight_share_snapshots';

const pools = new Map();

function getPoolConfig(db = '') {
  return {
    host: process.env.MYSQL_IP || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: db,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    multipleStatements: true, 
    typeCast: function (field, next) {
      if (field.type === 'DATETIME' || field.type === 'DATE' || field.type === 'TIMESTAMP') {
        return field.string();
      }
      return next();
    }
  };
}

async function getPool(dbName) {
  if (!pools.has(dbName)) {
    const pool = mysql.createPool(getPoolConfig(dbName));
    pools.set(dbName, pool);
  }
  return pools.get(dbName);
}

// --- Dataset Logic ---

const DATASETS_METADATA = [
  { 
    id: 'retail', 
    title: 'E-commerce Sales', 
    description: 'Orders, products, and customer transactions across regions.', 
    icon: 'ShoppingBag', 
    tables: ['ecommerce_orders', 'ecommerce_products'],
    topicName: 'Quarterly Sales Analysis' 
  },
  { 
    id: 'hr', 
    title: 'Workforce Analytics', 
    description: 'Employee demographics, salaries, and department structures.', 
    icon: 'Users', 
    tables: ['hr_employees', 'hr_departments'],
    topicName: 'HR Retention Report'
  },
  { 
    id: 'movies', 
    title: 'Movie Reviews', 
    description: 'Film database with user ratings and text comments.', 
    icon: 'Film', 
    tables: ['movies_list', 'movies_reviews'],
    topicName: 'Cinema Sentiment Study'
  },
  { 
    id: 'fitness', 
    title: 'Fitness Tracker', 
    description: 'Daily health metrics including steps, sleep, and heart rate.', 
    icon: 'Activity', // Note: Needs frontend support for this icon or fallback
    tables: ['fitness_metrics'],
    topicName: 'Health Habits Review'
  }
];

async function initDatasets(rootConn) {
  console.log("Initializing Master Datasets...");
  // 1. Create Master DB
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${MASTER_DATASET_DB}\``);
  const masterPool = await getPool(MASTER_DATASET_DB);

  // 2. Read and Execute SQL Files (stored as .md to bypass restrictions)
  const datasetsDir = path.join(process.cwd(), 'datasets');
  if (fs.existsSync(datasetsDir)) {
    const files = fs.readdirSync(datasetsDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const sqlContent = fs.readFileSync(path.join(datasetsDir, file), 'utf8');
          // Execute the whole file content. mysql2 with multipleStatements handles this.
          await masterPool.query(sqlContent);
          console.log(`Loaded dataset: ${file}`);
        } catch (e) {
          console.error(`Failed to load dataset ${file}:`, e.message);
        }
      }
    }
  }
}

async function initDemoData(sysPool, rootConn) {
  console.log("Initializing Demo Environment...");
  const DEMO_DB_NAME = 'seekinsight_demo';
  const DEMO_NB_ID = 'demo_fitness_001';
  const DEMO_APP_ID = 'demo_app_001';

  // 1. Create Demo DB
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DEMO_DB_NAME}\``);
  const demoPool = await getPool(DEMO_DB_NAME);

  // 2. Clone Fitness Table from Master Dataset
  // This replaces the old generateFitnessData logic
  try {
      await demoPool.query(`DROP TABLE IF EXISTS fitness_metrics`);
      // Clone Schema
      await demoPool.query(`CREATE TABLE fitness_metrics LIKE \`${MASTER_DATASET_DB}\`.fitness_metrics`);
      // Clone Data
      await demoPool.query(`INSERT INTO fitness_metrics SELECT * FROM \`${MASTER_DATASET_DB}\`.fitness_metrics`);
      console.log("Demo data cloned from master.");
  } catch (e) {
      console.warn("Failed to clone demo data (Master dataset might be missing fitness_metrics):", e.message);
  }

  // 3. Create Notebook Entry
  await sysPool.query(
    `INSERT IGNORE INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, created_at, views) VALUES (?, ?, ?, ?, ?, NOW(), 120)`,
    [DEMO_NB_ID, DEMO_DB_NAME, 'Health Tracker Demo', 0, 'Activity']
  );

  // 4. Create App Entry
  const sqlCode = `SELECT 
    name,
    AVG(steps) as avg_daily_steps,
    AVG(sleep_hours) as avg_sleep,
    AVG(calories_kcal) as avg_intake
FROM fitness_metrics
GROUP BY name
ORDER BY avg_daily_steps DESC;`;

  const snapshot = {
    result: {
      data: [
        { name: 'David', avg_daily_steps: 12050, avg_sleep: 7.9, avg_intake: 3010 },
        { name: 'Alice', avg_daily_steps: 6020, avg_sleep: 7.6, avg_intake: 1605 },
        { name: 'Bob', avg_daily_steps: 3050, avg_sleep: 6.1, avg_intake: 2790 },
        { name: 'Charlie', avg_daily_steps: 2580, avg_sleep: 5.8, avg_intake: 2550 }
      ],
      columns: ['name', 'avg_daily_steps', 'avg_sleep', 'avg_intake'],
      timestamp: new Date().toLocaleTimeString(),
      chartConfigs: [
         { type: "bar", xKey: "name", yKeys: ["avg_daily_steps"], title: "Activity Level by Person", description: "Average daily step count over the last year" },
         { type: "bar", xKey: "name", yKeys: ["avg_sleep"], title: "Sleep Quality Comparison", description: "Average nightly sleep hours" }
      ]
    },
    analysis: "### Health Analysis Summary\n\n**David (Athlete)** shows superior metrics..."
  };

  const demoPrompt = "Compare daily activity, sleep and calorie intake across all users.";

  await sysPool.query(
    `INSERT IGNORE INTO \`${PUBLISHED_APPS_TABLE}\` (id, title, description, prompt, author, type, code, source_db_name, source_notebook_id, snapshot_json, views) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 350)`,
    [DEMO_APP_ID, 'Yearly Health Habits Review', 'Comparative analysis...', demoPrompt, 'SeekInsight Demo', 'SQL', sqlCode, DEMO_DB_NAME, DEMO_NB_ID, JSON.stringify(snapshot)]
  );
}

async function initSystem() {
  const rootConn = await mysql.createConnection({
    host: process.env.MYSQL_IP || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || ''
  });

  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${SYSTEM_DB}\``);
  const sysPool = await getPool(SYSTEM_DB);
  
  await sysPool.query(`CREATE TABLE IF NOT EXISTS \`${NOTEBOOK_LIST_TABLE}\` (
      id VARCHAR(50) PRIMARY KEY,
      db_name VARCHAR(100) NOT NULL,
      topic VARCHAR(200) DEFAULT '未命名主题',
      user_id INT DEFAULT 0,
      icon_name VARCHAR(50),
      suggestions_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      views INT DEFAULT 0
    )`);

  await sysPool.query(`CREATE TABLE IF NOT EXISTS \`${PUBLISHED_APPS_TABLE}\` (
      id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      prompt TEXT,
      author VARCHAR(100) DEFAULT 'Anonymous',
      type VARCHAR(20) NOT NULL, 
      code MEDIUMTEXT,
      source_db_name VARCHAR(100),
      source_notebook_id VARCHAR(50),
      params_schema TEXT,
      snapshot_json LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      views INT DEFAULT 0
    )`);

  await sysPool.query(`CREATE TABLE IF NOT EXISTS \`${SHARE_SNAPSHOTS_TABLE}\` (
      id VARCHAR(12) PRIMARY KEY,
      app_id VARCHAR(50),
      params_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Ensure Columns Exist
  try {
    await sysPool.query(`ALTER TABLE \`${NOTEBOOK_LIST_TABLE}\` ADD COLUMN views INT DEFAULT 0`);
  } catch (err) {}
  try {
    await sysPool.query(`ALTER TABLE \`${NOTEBOOK_LIST_TABLE}\` ADD COLUMN suggestions_json TEXT`);
  } catch (err) {}
  try {
    await sysPool.query(`ALTER TABLE \`${PUBLISHED_APPS_TABLE}\` ADD COLUMN views INT DEFAULT 0`);
  } catch (err) {}
  try {
    await sysPool.query(`ALTER TABLE \`${PUBLISHED_APPS_TABLE}\` ADD COLUMN source_notebook_id VARCHAR(50)`);
  } catch (e) {}
  try {
    await sysPool.query(`ALTER TABLE \`${PUBLISHED_APPS_TABLE}\` ADD COLUMN prompt TEXT`);
  } catch (e) {}

  if (!fs.existsSync(LOCK_FILE)) {
    try {
      // ORDER MATTERS: Load Datasets first so Master DB is populated
      await initDatasets(rootConn);
      // Then Initialize Demo using data from Master DB
      await initDemoData(sysPool, rootConn);
      
      fs.writeFileSync(LOCK_FILE, new Date().toISOString());
      console.log("System initialized.");
    } catch (e) {
      console.error("Initialization Failed:", e);
    }
  } else {
      // Re-init datasets on every restart to pick up new SQL files if any
      await initDatasets(rootConn);
  }
  
  await rootConn.end();
}

// --- DATASET API ---

app.get('/datasets', (req, res) => {
    res.json(DATASETS_METADATA);
});

app.post('/datasets/import', async (req, res) => {
    const { dbName, datasetId } = req.body;
    if (!dbName || !datasetId) return res.status(400).json({ message: 'Missing params' });

    const dataset = DATASETS_METADATA.find(d => d.id === datasetId);
    if (!dataset) return res.status(404).json({ message: 'Dataset not found' });

    try {
        const userPool = await getPool(dbName);
        
        // Clone each table
        for (const tableName of dataset.tables) {
            // Drop existing to prevent errors (destructive import)
            await userPool.query(`DROP TABLE IF EXISTS \`${tableName}\``);
            
            // CREATE LIKE (Copies Schema)
            await userPool.query(`CREATE TABLE \`${tableName}\` LIKE \`${MASTER_DATASET_DB}\`.\`${tableName}\``);
            
            // INSERT SELECT (Copies Data)
            await userPool.query(`INSERT INTO \`${tableName}\` SELECT * FROM \`${MASTER_DATASET_DB}\`.\`${tableName}\``);
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Import Error:", err);
        res.status(500).json({ message: err.message });
    }
});

// --- Existing APIs ---

app.post('/shares', async (req, res) => {
  try {
    const { appId, params } = req.body;
    if (!appId) return res.status(400).json({ message: 'App ID required' });
    const id = crypto.randomBytes(4).toString('hex').substring(0, 8); 
    const pool = await getPool(SYSTEM_DB);
    await pool.query(`INSERT INTO \`${SHARE_SNAPSHOTS_TABLE}\` (id, app_id, params_json) VALUES (?, ?, ?)`, [id, appId, JSON.stringify(params || {})]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/shares/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool(SYSTEM_DB);
    const [rows] = await pool.query(`SELECT params_json FROM \`${SHARE_SNAPSHOTS_TABLE}\` WHERE id = ?`, [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Snapshot not found' });
    res.json(JSON.parse(rows[0].params_json || '{}'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/apps', async (req, res) => {
  try {
    const pool = await getPool(SYSTEM_DB);
    const [rows] = await pool.query(`SELECT * FROM \`${PUBLISHED_APPS_TABLE}\` ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/apps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool(SYSTEM_DB);
    const [rows] = await pool.query(`SELECT * FROM \`${PUBLISHED_APPS_TABLE}\` WHERE id = ?`, [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'App not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/apps/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool(SYSTEM_DB);
    await pool.query(`UPDATE \`${PUBLISHED_APPS_TABLE}\` SET views = views + 1 WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/apps', async (req, res) => {
  try {
    const { title, description, prompt, author, type, code, source_db_name, source_notebook_id, params_schema, snapshot_json } = req.body;
    const id = crypto.randomBytes(4).toString('hex');
    const pool = await getPool(SYSTEM_DB);
    await pool.query(
      `INSERT INTO \`${PUBLISHED_APPS_TABLE}\` (id, title, description, prompt, author, type, code, source_db_name, source_notebook_id, params_schema, snapshot_json, views) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, title, description, prompt, author || 'User', type, code, source_db_name, source_notebook_id, params_schema, snapshot_json]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/apps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, prompt, author, type, code, source_db_name, source_notebook_id, params_schema, snapshot_json } = req.body;
    const pool = await getPool(SYSTEM_DB);
    const [existing] = await pool.query(`SELECT id FROM \`${PUBLISHED_APPS_TABLE}\` WHERE id = ?`, [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'App not found' });
    await pool.query(
      `UPDATE \`${PUBLISHED_APPS_TABLE}\` SET title = ?, description = ?, prompt = ?, author = ?, type = ?, code = ?, source_db_name = ?, source_notebook_id = ?, params_schema = ?, snapshot_json = ? WHERE id = ?`,
      [title, description, prompt, author || 'User', type, code, source_db_name, source_notebook_id, params_schema, snapshot_json, id]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/apps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool(SYSTEM_DB);
    await pool.query(`DELETE FROM \`${PUBLISHED_APPS_TABLE}\` WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/notebooks', async (req, res) => {
  try {
    const pool = await getPool(SYSTEM_DB);
    const [rows] = await pool.query(`SELECT * FROM \`${NOTEBOOK_LIST_TABLE}\` ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/notebooks/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool(SYSTEM_DB);
    await pool.query(`UPDATE \`${NOTEBOOK_LIST_TABLE}\` SET views = views + 1 WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/notebooks', async (req, res) => {
  try {
    const id = crypto.randomBytes(4).toString('hex');
    const now = new Date();
    const timestamp = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0') + now.getDate().toString().padStart(2, '0') + now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0') + now.getSeconds().toString().padStart(2, '0');
    const dbName = `nb_${timestamp}_${id}`;
    
    const rootConn = await mysql.createConnection({
        host: process.env.MYSQL_IP || '127.0.0.1',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || ''
    });
    await rootConn.query(`CREATE DATABASE \`${dbName}\``);
    await rootConn.end();

    const icons = ['Database', 'Zap', 'Brain', 'BarChart3', 'Layers', 'Boxes', 'Cpu', 'Activity', 'LineChart', 'PieChart', 'Table', 'FileText', 'Globe', 'Server', 'Cloud', 'Code2', 'Terminal', 'ShieldCheck', 'Search', 'Filter', 'FolderGit2'];
    const randomIcon = icons[Math.floor(Math.random() * icons.length)];

    const sysPool = await getPool(SYSTEM_DB);
    await sysPool.query(`INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, views) VALUES (?, ?, ?, ?, ?, 0)`, [id, dbName, '未命名主题', 0, randomIcon]);

    res.json({ id, db_name: dbName, topic: '未命名主题', icon_name: randomIcon, views: 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/notebooks/clone', async (req, res) => {
    const { source_db_name, new_topic, suggestions_json } = req.body;
    try {
        const id = crypto.randomBytes(4).toString('hex');
        const now = new Date();
        const timestamp = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0') + now.getDate().toString().padStart(2, '0') + now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0') + now.getSeconds().toString().padStart(2, '0');
        const newDbName = `nb_${timestamp}_${id}`;

        const rootConn = await mysql.createConnection({
            host: process.env.MYSQL_IP || '127.0.0.1',
            port: parseInt(process.env.MYSQL_PORT || '3306'),
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || ''
        });

        await rootConn.query(`CREATE DATABASE \`${newDbName}\``);
        const [tables] = await rootConn.query(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`, [source_db_name]);

        for (const row of tables) {
            const tableName = row.TABLE_NAME;
            await rootConn.query(`CREATE TABLE \`${newDbName}\`.\`${tableName}\` LIKE \`${source_db_name}\`.\`${tableName}\``);
            await rootConn.query(`INSERT INTO \`${newDbName}\`.\`${tableName}\` SELECT * FROM \`${source_db_name}\`.\`${tableName}\``);
        }
        await rootConn.end();

        const sysPool = await getPool(SYSTEM_DB);
        const iconName = 'Copy'; 
        await sysPool.query(`INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, suggestions_json, views) VALUES (?, ?, ?, ?, ?, ?, 0)`, [id, newDbName, new_topic || 'Cloned Notebook', 0, iconName, suggestions_json]);
        const [newNb] = await sysPool.query(`SELECT * FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
        res.json(newNb[0]);
    } catch(err) {
        res.status(500).json({ message: "Failed to clone notebook: " + err.message });
    }
});

app.patch('/notebooks/:id', async (req, res) => {
  const { id } = req.params;
  const { topic, suggestions_json } = req.body;
  try {
    const sysPool = await getPool(SYSTEM_DB);
    let query = 'UPDATE `' + NOTEBOOK_LIST_TABLE + '` SET ';
    const params = [];
    const updates = [];
    if (topic !== undefined) { updates.push('topic = ?'); params.push(topic); }
    if (suggestions_json !== undefined) { updates.push('suggestions_json = ?'); params.push(suggestions_json); }
    if (updates.length === 0) return res.json({ success: true });
    query += updates.join(', ') + ' WHERE id = ?';
    params.push(id);
    await sysPool.query(query, params);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/notebooks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const sysPool = await getPool(SYSTEM_DB);
    const [rows] = await sysPool.query(`SELECT db_name FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
    if (rows.length > 0) {
      const dbToDrop = rows[0].db_name;
      const rootConn = await mysql.createConnection({
        host: process.env.MYSQL_IP || '127.0.0.1',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || ''
      });
      await rootConn.query(`DROP DATABASE IF EXISTS \`${dbToDrop}\``);
      await rootConn.end();
      pools.delete(dbToDrop);
    }
    await sysPool.query(`DELETE FROM \`${PUBLISHED_APPS_TABLE}\` WHERE source_notebook_id = ?`, [id]);
    await sysPool.query(`DELETE FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/sql', async (req, res) => {
  const { sql, dbName } = req.body;
  if (!dbName) return res.status(400).json({ message: 'Missing dbName' });
  try {
    const pool = await getPool(dbName);
    const [result, fields] = await pool.query(sql);
    let activeRows = result;
    let activeFields = fields;
    let isMulti = false;
    for (let i = 0; Array.isArray(fields) && i < fields.length; ++i) {
      if (Array.isArray(fields) && undefined === fields[i]) { isMulti = true; break; }
    }
    if (isMulti) {
       activeRows = result[result.length - 1];
       activeFields = fields[fields.length - 1];
    }
    if (Array.isArray(fields) && Array.isArray(fields[fields.length - 1])) {
         activeRows = result[result.length - 1];
         activeFields = fields[fields.length - 1];
    } else if (!fields && Array.isArray(result) && result.length > 0 && ('affectedRows' in result[0])) {
         activeRows = result[result.length - 1];
    }
    if (activeRows && 'affectedRows' in activeRows && !Array.isArray(activeRows)) {
         return res.json({
            rows: [{ status: 'Success', message: activeRows.info || 'Query executed successfully', affected_rows: activeRows.affectedRows, insert_id: activeRows.insertId, warning_count: activeRows.warningStatus }],
            columns: ['status', 'message', 'affected_rows', 'insert_id', 'warning_count']
         });
    }
    const columns = activeFields ? activeFields.map(f => f.name) : (Array.isArray(activeRows) && activeRows.length > 0 ? Object.keys(activeRows[0]) : []);
    res.json({ rows: Array.isArray(activeRows) ? activeRows : [activeRows], columns });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/python', async (req, res) => {
  const { code, dbName, executionMode, params } = req.body;
  if (!dbName) return res.status(400).json({ message: 'Missing dbName' });
  const host = process.env.MYSQL_IP || '127.0.0.1';
  const port = process.env.MYSQL_PORT || '3306';
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const connectionString = `mysql+mysqlconnector://${user}${password ? `:${encodeURIComponent(password)}` : ''}@${host}:${port}/${dbName}`;
  const envMode = executionMode === 'SCHEMA' ? 'SCHEMA' : 'EXECUTION';
  const envParams = params ? JSON.stringify(params) : '{}';

  const bridgeCode = `
import pandas as pd
from sqlalchemy import create_engine
import json
import os
import sys
import plotly.io as pio

class SI_Params:
    def __init__(self, mode, injected):
        self.mode = mode
        self.injected = injected
        self.schema = {}

    def get(self, key, default=None):
        if self.mode == 'SCHEMA':
             self.schema[key] = {'type': 'text', 'default': default, 'label': key}
             return default
        return self.injected.get(key, default)

    def slider(self, key, label=None, min=0, max=100, step=1, default=None, dtype=None):
        if default is None: default = min
        if self.mode == 'SCHEMA':
            self.schema[key] = {'type': 'slider', 'label': label or key, 'min': min, 'max': max, 'step': step, 'default': default, 'dtype': dtype}
            return default
        val = self.injected.get(key, default)
        try:
            if dtype == 'int': return int(float(val))
            elif dtype == 'float': return float(val)
            if isinstance(min, int) and isinstance(max, int) and isinstance(step, int) and isinstance(default, int): return int(float(val))
            return float(val)
        except: return default

    def select(self, key, label=None, options=[], sql=None, default=None):
        if self.mode == 'SCHEMA':
            final_opts = options or []
            if sql and not final_opts:
                try:
                    with engine.connect() as conn:
                        df = pd.read_sql(sql, conn)
                        if not df.empty: final_opts = df.iloc[:, 0].unique().tolist()[:50]
                except: pass
            if default is None and final_opts: default = final_opts[0]
            self.schema[key] = {'type': 'select', 'label': label or key, 'options': final_opts, 'default': default}
            return default
        return self.injected.get(key, default)

class SI_Wrapper:
    def __init__(self, engine, mode, params):
        self.engine = engine
        self.params = SI_Params(mode, params)
        self.mode = mode
    def sql(self, query):
        try: return pd.read_sql(query, self.engine)
        except Exception as e: print(f"SQL Error: {str(e)}", file=sys.stderr); return pd.DataFrame()
    def plot(self, fig):
        if self.mode == 'EXECUTION': print(f"__PLOTLY_DATA__:{pio.to_json(fig)}")
    def finalize(self):
        if self.mode == 'SCHEMA': print(f"__SCHEMA_JSON__:{json.dumps(self.params.schema)}")

try:
    engine = create_engine("${connectionString}")
    SI_MODE = os.environ.get('SI_EXEC_MODE', 'EXECUTION')
    try: SI_PARAMS_DICT = json.loads(os.environ.get('SI_PARAMS', '{}'))
    except: SI_PARAMS_DICT = {}
    SI = SI_Wrapper(engine, SI_MODE, SI_PARAMS_DICT)
    def sql(q): return SI.sql(q)
    def forge_plotly(f): return SI.plot(f)
except Exception as e: print(f"Bridge Setup Error: {str(e)}", file=sys.stderr)
`;

  const fullCode = bridgeCode + "\n" + code + "\n\nSI.finalize()";
  const requestId = crypto.randomBytes(4).toString('hex');
  const tmpFile = path.join(process.cwd(), `nb_exec_${requestId}_${Date.now()}.py`);
  fs.writeFileSync(tmpFile, fullCode);
  const pythonExe = getPythonExecutable();
  const childEnv = { ...process.env, SI_EXEC_MODE: envMode, SI_PARAMS: envParams };
  const pyProcess = spawn(pythonExe, [tmpFile], { env: childEnv });
  let stdout = '', stderr = '';

  pyProcess.on('error', (err) => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    res.status(500).json({ logs: [`Failed to start Python interpreter: ${err.message}`, `Command used: ${pythonExe}`], error: true });
  });
  pyProcess.stdout.on('data', (data) => stdout += data.toString());
  pyProcess.stderr.on('data', (data) => stderr += data.toString());
  pyProcess.on('close', (exitCode) => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    if (res.headersSent) return;
    let plotlyData = null, schemaData = null;
    const lines = stdout.split('\n');
    const logs = lines.filter(line => {
      if (line.startsWith("__PLOTLY_DATA__:")) { try { plotlyData = JSON.parse(line.replace("__PLOTLY_DATA__:", '')); } catch(e) {} return false; }
      if (line.startsWith("__SCHEMA_JSON__:")) { try { schemaData = JSON.parse(line.replace("__SCHEMA_JSON__:", '')); } catch(e) {} return false; }
      return true;
    });
    if (exitCode !== 0) {
      res.status(500).json({ logs: logs.concat(stderr.split('\n')), error: true });
    } else {
      res.json({ logs, plotlyData, schemaData, timestamp: new Date().toLocaleTimeString() });
    }
  });
});

app.post('/log-prompt', (req, res) => res.sendStatus(200));

initSystem().then(() => {
  app.listen(PORT, () => console.log(`🚀 Gateway running at http://localhost:${PORT}`));
});
