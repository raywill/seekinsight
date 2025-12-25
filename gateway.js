
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001; // 统一为 3001
const VENV_PATH = path.join(process.cwd(), '.venv');
const PYTHON_EXE = process.platform === 'win32' 
  ? path.join(VENV_PATH, 'Scripts', 'python.exe') 
  : path.join(VENV_PATH, 'bin', 'python');

const SYSTEM_DB = 'seekinsight';
const NOTEBOOK_LIST_TABLE = 'seekinsight_notebook_list';

// Pool Management
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
    queueLimit: 0
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
  await sysPool.query(`
    CREATE TABLE IF NOT EXISTS \`${NOTEBOOK_LIST_TABLE}\` (
      id VARCHAR(50) PRIMARY KEY,
      db_name VARCHAR(100) NOT NULL,
      topic VARCHAR(200) DEFAULT '未命名主题',
      user_id INT DEFAULT 0,
      icon_name VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Lobby APIs
app.get('/notebooks', async (req, res) => {
  try {
    const pool = await getPool(SYSTEM_DB);
    const [rows] = await pool.query(`SELECT * FROM \`${NOTEBOOK_LIST_TABLE}\` ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/notebooks', async (req, res) => {
  try {
    const id = crypto.randomBytes(4).toString('hex');
    // 规范命名: nb_yyyyMMddHHmmss_uuid
    const now = new Date();
    const timestamp = now.getFullYear().toString() + 
                      (now.getMonth() + 1).toString().padStart(2, '0') + 
                      now.getDate().toString().padStart(2, '0') + 
                      now.getHours().toString().padStart(2, '0') + 
                      now.getMinutes().toString().padStart(2, '0') + 
                      now.getSeconds().toString().padStart(2, '0');
    const dbName = `nb_${timestamp}_${id}`;
    
    // 物理库创建
    const rootConn = await mysql.createConnection({
        host: process.env.MYSQL_IP || '127.0.0.1',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || ''
    });
    await rootConn.query(`CREATE DATABASE \`${dbName}\``);
    await rootConn.end();

    // 随机图标
    const icons = ['Database', 'Zap', 'Brain', 'BarChart3', 'Layers', 'Boxes', 'Cpu', 'Activity'];
    const randomIcon = icons[Math.floor(Math.random() * icons.length)];

    // 控制平面注册 (user_id 预留为 0)
    const sysPool = await getPool(SYSTEM_DB);
    await sysPool.query(
      `INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name) VALUES (?, ?, ?, ?, ?)`,
      [id, dbName, '未命名主题', 0, randomIcon]
    );

    res.json({ id, db_name: dbName, topic: '未命名主题', icon_name: randomIcon });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch('/notebooks/:id', async (req, res) => {
  const { id } = req.params;
  const { topic } = req.body;
  try {
    const sysPool = await getPool(SYSTEM_DB);
    await sysPool.query(`UPDATE \`${NOTEBOOK_LIST_TABLE}\` SET topic = ? WHERE id = ?`, [topic, id]);
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

    await sysPool.query(`DELETE FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Execution APIs
app.post('/sql', async (req, res) => {
  const { sql, dbName } = req.body;
  if (!dbName) return res.status(400).json({ message: 'Missing dbName' });
  try {
    const pool = await getPool(dbName);
    const [rows, fields] = await pool.query(sql);
    const columns = fields ? fields.map(f => f.name) : (Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0]) : []);
    res.json({ rows: Array.isArray(rows) ? rows : [rows], columns });
  } catch (err) {
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
engine = create_engine("${connectionString}")
def sql(query): return pd.read_sql(query, engine)
def forge_plotly(fig): print(f"__PLOTLY_DATA__:{pio.to_json(fig)}")
`;

  const fullCode = bridgeCode + "\n" + code;
  const requestId = crypto.randomBytes(4).toString('hex');
  const tmpFile = path.join(process.cwd(), `nb_exec_${requestId}_${Date.now()}.py`);
  
  fs.writeFileSync(tmpFile, fullCode);
  const pyProcess = spawn(PYTHON_EXE, [tmpFile]);
  let stdout = '';
  let stderr = '';

  pyProcess.stdout.on('data', (data) => stdout += data.toString());
  pyProcess.stderr.on('data', (data) => stderr += data.toString());

  pyProcess.on('close', (exitCode) => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
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
