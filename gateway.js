
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

async function initVenv() {
  console.log('[Venv] Checking environment status...');
  if (!fs.existsSync(VENV_PATH)) {
    console.log('[Venv] Environment not found. Creating virtual environment...');
    await execPromise(`python3 -m venv ${VENV_PATH}`);
  }
  
  console.log('[Venv] Syncing dependencies (pandas, scikit-learn, matplotlib, seaborn, plotly, etc.)...');
  const pipPath = process.platform === 'win32' 
    ? path.join(VENV_PATH, 'Scripts', 'pip.exe') 
    : path.join(VENV_PATH, 'bin', 'pip');
    
  const packages = [
    'pandas', 
    'sqlalchemy', 
    'mysql-connector-python', 
    'numpy', 
    'scipy', 
    'scikit-learn', 
    'matplotlib', 
    'seaborn', 
    'statsmodels',
    'plotly'
  ].join(' ');
  
  await execPromise(`${pipPath} install ${packages} --quiet`);
  console.log('[Venv] Python runtime environment is ready.');
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
  if (!connection) return res.status(400).json({ message: 'No active database connection' });
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
  if (!dbConfig) return res.status(400).json({ message: 'Database not connected. Python runtime requires DB context.' });

  const passwordPart = dbConfig.password ? `:${encodeURIComponent(dbConfig.password)}` : '';
  const authPart = `${encodeURIComponent(dbConfig.user)}${passwordPart}`;
  const connectionString = `mysql+mysqlconnector://${authPart}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

  const bridgeCode = `
import pandas as pd
from sqlalchemy import create_engine
import json
import sys
import plotly.io as pio

# Securely initialized engine
engine = create_engine("${connectionString}")

def sql(query):
    """Executes SQL and returns a Pandas DataFrame."""
    return pd.read_sql(query, engine)

def forge_plot(df, type='bar'):
    """Sends visual data back to the UI (Legacy)."""
    print(f"__PLOT_DATA__:{df.to_json(orient='records')}")

def forge_plotly(fig):
    """Sends Plotly JSON back to the UI for interactive charting."""
    print(f"__PLOTLY_DATA__:{pio.to_json(fig)}")

# --- User Code Execution ---
`;

  const fullCode = bridgeCode + "\n" + code;
  const tmpFile = path.join(process.cwd(), `tmp_exec_${Date.now()}.py`);
  
  fs.writeFileSync(tmpFile, fullCode);

  const pyProcess = spawn(PYTHON_EXE, [tmpFile]);
  let stdout = '';
  let stderr = '';

  pyProcess.stdout.on('data', (data) => stdout += data.toString());
  pyProcess.stderr.on('data', (data) => stderr += data.toString());

  pyProcess.on('close', (code) => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    
    const plotMarker = "__PLOT_DATA__:";
    const plotlyMarker = "__PLOTLY_DATA__:";
    let plotData = null;
    let plotlyData = null;
    
    const lines = stdout.split('\n');
    const logs = lines.filter(line => {
      if (line.startsWith(plotMarker)) {
        try {
          plotData = JSON.parse(line.replace(plotMarker, ''));
        } catch(e) { console.error("Failed to parse plot data", e); }
        return false;
      }
      if (line.startsWith(plotlyMarker)) {
        try {
          plotlyData = JSON.parse(line.replace(plotlyMarker, ''));
        } catch(e) { console.error("Failed to parse plotly data", e); }
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
        plotlyData: plotlyData,
        columns: plotData && plotData.length > 0 ? Object.keys(plotData[0]) : [],
        timestamp: new Date().toLocaleTimeString() 
      });
    }
  });
});

initVenv().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 SeekInsight Gateway (SQL & Python) running at http://localhost:${PORT}`);
  });
});
