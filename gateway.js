
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { performance } from 'perf_hooks';

const execPromise = promisify(exec);
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const VENV_PATH = path.join(process.cwd(), '.venv');
const PYTHON_EXE = process.platform === 'win32' 
  ? path.join(VENV_PATH, 'Scripts', 'python.exe') 
  : path.join(VENV_PATH, 'bin', 'python');

// Debug Switch from environment
const IS_DEBUG = process.env.SI_DEBUG_MODE !== 'false';
const PROMPT_LOG_FILE = path.join(process.cwd(), 'prompt.log');

function debugLog(step, message, duration = null) {
  if (!IS_DEBUG) return;
  const timestamp = new Date().toISOString().split('T')[1].split('Z')[0];
  const durationStr = duration !== null ? ` [${duration.toFixed(2)}ms]` : '';
  console.log(`\x1b[36m[DEBUG][${timestamp}]\x1b[0m \x1b[33m${step.padEnd(15)}\x1b[0m | ${message}${durationStr}`);
}

let dbConfig = null;
let connection = null;

async function initVenv() {
  const start = performance.now();
  debugLog('Venv', 'Checking environment status...');
  if (!fs.existsSync(VENV_PATH)) {
    debugLog('Venv', 'Environment not found. Creating virtual environment...');
    await execPromise(`python3 -m venv ${VENV_PATH}`);
  }
  
  debugLog('Venv', 'Syncing dependencies...');
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
  debugLog('Venv', 'Python runtime environment is ready.', performance.now() - start);
}

// Endpoint to log AI prompts to prompt.log
app.post('/log-prompt', (req, res) => {
  const { type, content } = req.body;
  if (!IS_DEBUG) return res.sendStatus(200);

  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${type}]\n${content}\n${'-'.repeat(50)}\n`;
  
  try {
    fs.appendFileSync(PROMPT_LOG_FILE, entry);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to write to prompt.log:", err);
    res.status(500).json({ success: false });
  }
});

app.post('/connect', async (req, res) => {
  const start = performance.now();
  const { host, port, user, password, database } = req.body;
  dbConfig = { host, port, user, password, database };
  
  debugLog('Connect', `Attempting connection to ${host}:${port}/${database}...`);
  try {
    if (connection) {
      debugLog('Connect', 'Closing existing connection...');
      await connection.end().catch(() => {});
    }
    connection = await mysql.createConnection({
      host, port: parseInt(port), user, password, database
    });
    await connection.ping();
    debugLog('Connect', 'Success.', performance.now() - start);
    res.json({ success: true, sessionId: Date.now().toString() });
  } catch (err) {
    debugLog('Connect', `Failed: ${err.message}`, performance.now() - start);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/sql', async (req, res) => {
  const start = performance.now();
  const { sql } = req.body;
  
  debugLog('SQL_Exec', `Received query: ${sql.substring(0, 50)}${sql.length > 50 ? '...' : ''}`);

  if (!connection) {
    debugLog('SQL_Exec', 'Error: No active database connection');
    return res.status(400).json({ message: 'No active database connection' });
  }

  try {
    const queryStart = performance.now();
    let [rows, fields] = await connection.query(sql);
    const queryDuration = performance.now() - queryStart;
    debugLog('SQL_Exec', `Raw query finished. Rows: ${Array.isArray(rows) ? rows.length : 1}`, queryDuration);

    const transformStart = performance.now();
    const isMulti = Array.isArray(fields) && fields.length > 0 && (Array.isArray(fields[0]) || fields[0] === undefined);
    if (isMulti) {
      debugLog('SQL_Exec', 'Detected multi-statement result. Extracting final result set...');
      rows = rows[rows.length - 1];
      fields = fields[fields.length - 1];
    }
    const columns = fields ? fields.map(f => f.name) : (Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0]) : []);
    const result = { rows: Array.isArray(rows) ? rows : [rows], columns };
    
    debugLog('SQL_Exec', 'Result transformation finished.', performance.now() - transformStart);
    debugLog('SQL_Exec', 'Total SQL request handling complete.', performance.now() - start);
    
    res.json(result);
  } catch (err) {
    debugLog('SQL_Exec', `Error: ${err.message}`, performance.now() - start);
    res.status(500).json({ message: err.message });
  }
});

app.post('/python', async (req, res) => {
  const start = performance.now();
  const { code } = req.body;
  
  debugLog('Python_Exec', 'Initiating script execution...');

  if (!dbConfig) {
    debugLog('Python_Exec', 'Error: Database not connected.');
    return res.status(400).json({ message: 'Database not connected. Python runtime requires DB context.' });
  }

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
  
  const writeStart = performance.now();
  fs.writeFileSync(tmpFile, fullCode);
  debugLog('Python_Exec', 'Temporary script written.', performance.now() - writeStart);

  debugLog('Python_Exec', 'Spawning Python process...');
  const processStart = performance.now();
  const pyProcess = spawn(PYTHON_EXE, [tmpFile]);
  let stdout = '';
  let stderr = '';

  pyProcess.stdout.on('data', (data) => stdout += data.toString());
  pyProcess.stderr.on('data', (data) => stderr += data.toString());

  pyProcess.on('close', (code) => {
    const processDuration = performance.now() - processStart;
    debugLog('Python_Exec', `Python process closed with exit code ${code}`, processDuration);

    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    
    const parseStart = performance.now();
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

    debugLog('Python_Exec', 'Log parsing finished.', performance.now() - parseStart);

    if (code !== 0) {
      debugLog('Python_Exec', 'Execution failed with errors.', performance.now() - start);
      res.status(500).json({ logs: logs.concat(stderr.split('\n')), error: true });
    } else {
      debugLog('Python_Exec', 'Execution successful.', performance.now() - start);
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
    if (IS_DEBUG) {
      console.log(`\x1b[32m[INFO] Debug Mode is ON. Detailed timing logs will be shown below.\x1b[0m`);
    }
  });
});
