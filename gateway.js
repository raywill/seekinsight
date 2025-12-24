
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const VENV_PATH = path.join(process.cwd(), '.venv');
const PYTHON_EXE = process.platform === 'win32' 
  ? path.join(VENV_PATH, 'Scripts', 'python.exe') 
  : path.join(VENV_PATH, 'bin', 'python');

let dbConfig = null;
let connection = null;

// Ensure Python Virtual Environment exists and has dependencies
async function initVenv() {
  console.log('[Venv] Checking environment...');
  if (!fs.existsSync(VENV_PATH)) {
    console.log('[Venv] Creating virtual environment...');
    await execPromise(`python3 -m venv ${VENV_PATH}`);
  }
  
  console.log('[Venv] Installing dependencies (pandas, sqlalchemy, mysql-connector-python)...');
  // Use the venv's pip to install
  const pipPath = process.platform === 'win32' 
    ? path.join(VENV_PATH, 'Scripts', 'pip.exe') 
    : path.join(VENV_PATH, 'bin', 'pip');
    
  await execPromise(`${pipPath} install pandas sqlalchemy mysql-connector-python`);
  console.log('[Venv] Environment ready.');
}

app.post('/connect', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  dbConfig = { host, port, user, password, database };
  
  try {
    if (connection) await connection.end().catch(() => {});
    connection = await mysql.createConnection({
      host, port: parseInt(port), user, password, database
    });
    await connection.ping();
    res.json({ success: true, sessionId: Date.now().toString() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/sql', async (req, res) => {
  const { sql } = req.body;
  if (!connection) return res.status(400).json({ message: 'No active connection' });
  try {
    let [rows, fields] = await connection.query(sql);
    const isMulti = Array.isArray(fields) && fields.length > 0 && (Array.isArray(fields[0]) || fields[0] === undefined);
    if (isMulti) {
      rows = rows[rows.length - 1];
      fields = fields[fields.length - 1];
    }
    const columns = fields ? fields.map(f => f.name) : (Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0]) : []);
    res.json({ rows: Array.isArray(rows) ? rows : [rows], columns });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/python', async (req, res) => {
  const { code } = req.body;
  if (!dbConfig) return res.status(400).json({ message: 'Database not connected. Python needs DB context.' });

  // Inject bridge code to allow sql() function usage in Python
  const bridgeCode = `
import pandas as pd
from sqlalchemy import create_engine
import json
import sys

# Database Bridge
engine = create_engine("mysql+mysqlconnector://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}")

def sql(query):
    return pd.read_sql(query, engine)

def forge_plot(df, type='bar'):
    # Simple simulation of passing plot data back to UI
    print(f"__PLOT_DATA__:{df.to_json(orient='records')}")

# --- User Code Starts Here ---
`;

  const fullCode = bridgeCode + "\n" + code;
  const tmpFile = path.join(process.cwd(), `tmp_${Date.now()}.py`);
  
  fs.writeFileSync(tmpFile, fullCode);

  const pyProcess = spawn(PYTHON_EXE, [tmpFile]);
  let stdout = '';
  let stderr = '';

  pyProcess.stdout.on('data', (data) => stdout += data.toString());
  pyProcess.stderr.on('data', (data) => stderr += data.toString());

  pyProcess.on('close', (code) => {
    fs.unlinkSync(tmpFile);
    
    // Extract potential plot data from stdout
    const plotMarker = "__PLOT_DATA__:";
    let plotData = null;
    const lines = stdout.split('\n');
    const logs = lines.filter(line => {
      if (line.startsWith(plotMarker)) {
        plotData = JSON.parse(line.replace(plotMarker, ''));
        return false;
      }
      return true;
    });

    if (code !== 0) {
      res.status(500).json({ logs: logs.concat(stderr.split('\n')), error: true });
    } else {
      res.json({ 
        logs, 
        data: plotData || [], 
        columns: plotData && plotData.length > 0 ? Object.keys(plotData[0]) : [],
        timestamp: new Date().toLocaleTimeString() 
      });
    }
  });
});

initVenv().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 SQL & Python Gateway running at http://localhost:${PORT}`);
  });
});
