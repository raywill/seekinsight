
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for snapshots

const PORT = 3001;
const IS_DEBUG = process.env.SI_DEBUG_MODE !== 'false';
const VENV_PATH = path.join(process.cwd(), '.venv');
const VENV_PYTHON = process.platform === 'win32' 
  ? path.join(VENV_PATH, 'Scripts', 'python.exe') 
  : path.join(VENV_PATH, 'bin', 'python');

function getPythonExecutable() {
  if (fs.existsSync(VENV_PYTHON)) {
    return VENV_PYTHON;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

const SYSTEM_DB = 'seekinsight';
const NOTEBOOK_LIST_TABLE = 'seekinsight_notebook_list';
const PUBLISHED_APPS_TABLE = 'seekinsight_published_apps';

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
    // CRITICAL FIX: Prevent mysql2 from converting DATETIME to JS Date objects
    dateStrings: true,
    typeCast: function (field, next) {
      // Force return strings for all date-related types to avoid timezone conversion in JS
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

async function initSystem() {
  const rootConn = await mysql.createConnection({
    host: process.env.MYSQL_IP || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || ''
  });

  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${SYSTEM_DB}\``);
  await rootConn.end();

  const sysPool = await getPool(SYSTEM_DB);
  
  // Notebook List Table
  await sysPool.query(`
    CREATE TABLE IF NOT EXISTS \`${NOTEBOOK_LIST_TABLE}\` (
      id VARCHAR(50) PRIMARY KEY,
      db_name VARCHAR(100) NOT NULL,
      topic VARCHAR(200) DEFAULT '未命名主题',
      user_id INT DEFAULT 0,
      icon_name VARCHAR(50),
      suggestions_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    const [columns] = await sysPool.query(`SHOW COLUMNS FROM \`${NOTEBOOK_LIST_TABLE}\` LIKE 'suggestions_json'`);
    if (columns.length === 0) {
      await sysPool.query(`ALTER TABLE \`${NOTEBOOK_LIST_TABLE}\` ADD COLUMN suggestions_json TEXT`);
    }
  } catch (err) {
    if (IS_DEBUG) console.error("Migration error:", err);
  }

  // Published Apps Table
  await sysPool.query(`
    CREATE TABLE IF NOT EXISTS \`${PUBLISHED_APPS_TABLE}\` (
      id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      author VARCHAR(100) DEFAULT 'Anonymous',
      type VARCHAR(20) NOT NULL, 
      code MEDIUMTEXT,
      source_db_name VARCHAR(100),
      source_notebook_id VARCHAR(50),
      params_schema TEXT,
      snapshot_json LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    const [columns] = await sysPool.query(`SHOW COLUMNS FROM \`${PUBLISHED_APPS_TABLE}\` LIKE 'source_notebook_id'`);
    if (columns.length === 0) {
        await sysPool.query(`ALTER TABLE \`${PUBLISHED_APPS_TABLE}\` ADD COLUMN source_notebook_id VARCHAR(50)`);
    }
  } catch (e) {}
}

// --- Apps API ---

app.get('/apps', async (req, res) => {
  try {
    const pool = await getPool(SYSTEM_DB);
    const [rows] = await pool.query(`SELECT * FROM \`${PUBLISHED_APPS_TABLE}\` ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    console.error("[Apps GET Error]:", err);
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
    console.error("[Apps GET Single Error]:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/apps', async (req, res) => {
  try {
    const { title, description, author, type, code, source_db_name, source_notebook_id, params_schema, snapshot_json } = req.body;
    const id = crypto.randomBytes(4).toString('hex');
    const pool = await getPool(SYSTEM_DB);
    
    await pool.query(
      `INSERT INTO \`${PUBLISHED_APPS_TABLE}\` (id, title, description, author, type, code, source_db_name, source_notebook_id, params_schema, snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description, author || 'User', type, code, source_db_name, source_notebook_id, params_schema, snapshot_json]
    );
    
    res.json({ success: true, id });
  } catch (err) {
    console.error("[Apps POST Error]:", err);
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
    console.error("[Apps DELETE Error]:", err);
    res.status(500).json({ message: err.message });
  }
});

// --- Notebook API ---

app.get('/notebooks', async (req, res) => {
  try {
    const pool = await getPool(SYSTEM_DB);
    const [rows] = await pool.query(`SELECT * FROM \`${NOTEBOOK_LIST_TABLE}\` ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    if (IS_DEBUG) console.error("[Lobby GET Error]:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/notebooks', async (req, res) => {
  try {
    const id = crypto.randomBytes(4).toString('hex');
    const now = new Date();
    const timestamp = now.getFullYear().toString() + 
                      (now.getMonth() + 1).toString().padStart(2, '0') + 
                      now.getDate().toString().padStart(2, '0') + 
                      now.getHours().toString().padStart(2, '0') + 
                      now.getMinutes().toString().padStart(2, '0') + 
                      now.getSeconds().toString().padStart(2, '0');
    const dbName = `nb_${timestamp}_${id}`;
    
    const rootConn = await mysql.createConnection({
        host: process.env.MYSQL_IP || '127.0.0.1',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || ''
    });
    await rootConn.query(`CREATE DATABASE \`${dbName}\``);
    await rootConn.end();

    const icons = [
      'Database', 'Zap', 'Brain', 'BarChart3', 'Layers', 'Boxes', 'Cpu', 'Activity',
      'LineChart', 'PieChart', 'Table', 'FileText', 'Globe', 'Server', 'Cloud', 'Code2',
      'Terminal', 'ShieldCheck', 'Search', 'Filter', 'FolderGit2'
    ];
    const randomIcon = icons[Math.floor(Math.random() * icons.length)];

    const sysPool = await getPool(SYSTEM_DB);
    await sysPool.query(
      `INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name) VALUES (?, ?, ?, ?, ?)`,
      [id, dbName, '未命名主题', 0, randomIcon]
    );

    res.json({ id, db_name: dbName, topic: '未命名主题', icon_name: randomIcon });
  } catch (err) {
    if (IS_DEBUG) console.error("[Lobby POST Error]:", err);
    res.status(500).json({ message: err.message });
  }
});

// CLONE Notebook Logic
app.post('/notebooks/clone', async (req, res) => {
    const { source_db_name, new_topic, suggestions_json } = req.body;
    
    try {
        const id = crypto.randomBytes(4).toString('hex');
        const now = new Date();
        const timestamp = now.getFullYear().toString() + 
                          (now.getMonth() + 1).toString().padStart(2, '0') + 
                          now.getDate().toString().padStart(2, '0') + 
                          now.getHours().toString().padStart(2, '0') + 
                          now.getMinutes().toString().padStart(2, '0') + 
                          now.getSeconds().toString().padStart(2, '0');
        const newDbName = `nb_${timestamp}_${id}`;

        const rootConn = await mysql.createConnection({
            host: process.env.MYSQL_IP || '127.0.0.1',
            port: parseInt(process.env.MYSQL_PORT || '3306'),
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || ''
        });

        // 1. Create New Database
        await rootConn.query(`CREATE DATABASE \`${newDbName}\``);

        // 2. Clone Tables (Structure and Data)
        // Get list of tables from source
        const [tables] = await rootConn.query(`
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
        `, [source_db_name]);

        for (const row of tables) {
            const tableName = row.TABLE_NAME;
            // Create table like source
            await rootConn.query(`CREATE TABLE \`${newDbName}\`.\`${tableName}\` LIKE \`${source_db_name}\`.\`${tableName}\``);
            // Insert data
            await rootConn.query(`INSERT INTO \`${newDbName}\`.\`${tableName}\` SELECT * FROM \`${source_db_name}\`.\`${tableName}\``);
        }
        
        await rootConn.end();

        // 3. Register Notebook
        const sysPool = await getPool(SYSTEM_DB);
        const iconName = 'Copy'; // Clone icon
        await sysPool.query(
            `INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, suggestions_json) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, newDbName, new_topic || 'Cloned Notebook', 0, iconName, suggestions_json]
        );
        
        // 4. Return new notebook object
        const [newNb] = await sysPool.query(`SELECT * FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
        
        res.json(newNb[0]);

    } catch(err) {
        console.error("[Clone Error]:", err);
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

    if (topic !== undefined) {
      updates.push('topic = ?');
      params.push(topic);
    }
    if (suggestions_json !== undefined) {
      updates.push('suggestions_json = ?');
      params.push(suggestions_json);
    }

    if (updates.length === 0) return res.json({ success: true });

    query += updates.join(', ') + ' WHERE id = ?';
    params.push(id);

    await sysPool.query(query, params);
    res.json({ success: true });
  } catch (err) {
    if (IS_DEBUG) console.error("[Lobby PATCH Error]:", err);
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

    await sysPool.query(`DELETE FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    if (IS_DEBUG) console.error("[Lobby DELETE Error]:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/sql', async (req, res) => {
  const { sql, dbName } = req.body;
  if (!dbName) return res.status(400).json({ message: 'Missing dbName' });
  try {
    const pool = await getPool(dbName);
    const [rows, fields] = await pool.query(sql);
    const columns = fields ? fields.map(f => f.name) : (Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0]) : []);
    res.json({ rows: Array.isArray(rows) ? rows : [rows], columns });
  } catch (err) {
    if (IS_DEBUG) {
      console.error(`[SQL Error in ${dbName}]:`, err.message);
      console.error(`Query: ${sql}`);
    }
    res.status(500).json({ message: err.message });
  }
});

app.post('/python', async (req, res) => {
  const { code, dbName } = req.body;
  if (!dbName) return res.status(400).json({ message: 'Missing dbName' });

  const host = process.env.MYSQL_IP || '127.0.0.1';
  const port = process.env.MYSQL_PORT || '3306';
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const connectionString = `mysql+mysqlconnector://${user}${password ? `:${encodeURIComponent(password)}` : ''}@${host}:${port}/${dbName}`;

  const bridgeCode = `
import pandas as pd
from sqlalchemy import create_engine
import json
import sys
import plotly.io as pio
try:
    # Use coerce_datetime=False to keep dates as strings if possible or rely on pandas default
    engine = create_engine("${connectionString}")
    def sql(query): return pd.read_sql(query, engine)
    def forge_plotly(fig): print(f"__PLOTLY_DATA__:{pio.to_json(fig)}")
    
    # Init empty params if not injected
    if 'SI_PARAMS' not in globals():
        SI_PARAMS = {}
except Exception as e:
    print(f"Bridge Setup Error: {str(e)}", file=sys.stderr)
`;

  const fullCode = bridgeCode + "\n" + code;
  const requestId = crypto.randomBytes(4).toString('hex');
  const tmpFile = path.join(process.cwd(), `nb_exec_${requestId}_${Date.now()}.py`);
  
  fs.writeFileSync(tmpFile, fullCode);
  
  const pythonExe = getPythonExecutable();
  const pyProcess = spawn(pythonExe, [tmpFile]);
  
  let stdout = '';
  let stderr = '';

  pyProcess.on('error', (err) => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    if (IS_DEBUG) console.error(`[Python Spawn Error]: ${err.message}`);
    res.status(500).json({ 
      logs: [`Failed to start Python interpreter: ${err.message}`, `Command used: ${pythonExe}`], 
      error: true 
    });
  });

  pyProcess.stdout.on('data', (data) => stdout += data.toString());
  pyProcess.stderr.on('data', (data) => stderr += data.toString());

  pyProcess.on('close', (exitCode) => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    if (res.headersSent) return;

    let plotlyData = null;
    const lines = stdout.split('\n');
    const logs = lines.filter(line => {
      if (line.startsWith("__PLOTLY_DATA__:")) {
        try { plotlyData = JSON.parse(line.replace("__PLOTLY_DATA__:", '')); } catch(e) {}
        return false;
      }
      return true;
    });

    if (exitCode !== 0) {
      if (IS_DEBUG) {
        console.error(`[Python Execution Error in ${dbName}] Exit Code: ${exitCode}`);
        console.error(`Stderr: ${stderr}`);
      }
      res.status(500).json({ logs: logs.concat(stderr.split('\n')), error: true });
    } else {
      res.json({ logs, plotlyData, timestamp: new Date().toLocaleTimeString() });
    }
  });
});

app.post('/log-prompt', (req, res) => res.sendStatus(200));

initSystem().then(() => {
  app.listen(PORT, () => console.log(`🚀 Gateway running at http://localhost:${PORT}`));
});
