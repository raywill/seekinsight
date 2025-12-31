
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPythonExecutable, IS_DEBUG } from './common.js';

export default function(app) {
  app.post('/python', async (req, res) => {
    const { code, dbName, executionMode, params } = req.body; // Added executionMode and params
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
            self.schema[key] = {
                'type': 'slider', 'label': label or key,
                'min': min, 'max': max, 'step': step, 'default': default,
                'dtype': dtype
            }
            return default
        
        val = self.injected.get(key, default)
        try:
            # 1. Explicit request
            if dtype == 'int':
                return int(float(val))
            elif dtype == 'float':
                return float(val)

            # 2. Implicit inference (Streamlit style)
            # If everything provided is integer-like, return int
            is_int_env = isinstance(min, int) and isinstance(max, int) and isinstance(step, int) and isinstance(default, int)
            if is_int_env:
                return int(float(val))
            
            return float(val)
        except: 
            return default

    def select(self, key, label=None, options=[], sql=None, default=None):
        if self.mode == 'SCHEMA':
            final_opts = options or []
            if sql and not final_opts:
                try:
                    # Use a fresh connection from the engine to avoid interference
                    with engine.connect() as conn:
                        df = pd.read_sql(sql, conn)
                        if not df.empty:
                            final_opts = df.iloc[:, 0].unique().tolist()[:50]
                except Exception as e:
                    pass
            
            if default is None and final_opts: default = final_opts[0]
            
            self.schema[key] = {
                'type': 'select', 'label': label or key,
                'options': final_opts, 'default': default
            }
            return default
        return self.injected.get(key, default)

class SI_Wrapper:
    def __init__(self, engine, mode, params):
        self.engine = engine
        self.params = SI_Params(mode, params)
        self.mode = mode

    def sql(self, query):
        try:
            return pd.read_sql(query, self.engine)
        except Exception as e:
            print(f"SQL Error: {str(e)}", file=sys.stderr)
            return pd.DataFrame()

    def plot(self, fig):
        if self.mode == 'EXECUTION':
            print(f"__PLOTLY_DATA__:{pio.to_json(fig)}")

    def finalize(self):
        if self.mode == 'SCHEMA':
            print(f"__SCHEMA_JSON__:{json.dumps(self.params.schema)}")

# Initialize
try:
    engine = create_engine("${connectionString}")
    
    # Environment Setup
    SI_MODE = os.environ.get('SI_EXEC_MODE', 'EXECUTION')
    try:
        SI_PARAMS_DICT = json.loads(os.environ.get('SI_PARAMS', '{}'))
    except:
        SI_PARAMS_DICT = {}

    SI = SI_Wrapper(engine, SI_MODE, SI_PARAMS_DICT)
    
    # Legacy Alias Support (Optional, can be removed if prompt is strict)
    def sql(q): return SI.sql(q)
    def forge_plotly(f): return SI.plot(f)
    
except Exception as e:
    print(f"Bridge Setup Error: {str(e)}", file=sys.stderr)
`;

    const fullCode = bridgeCode + "\n" + code + "\n\nSI.finalize()";
    const requestId = crypto.randomBytes(4).toString('hex');
    const tmpFile = path.join(process.cwd(), `nb_exec_${requestId}_${Date.now()}.py`);
    
    fs.writeFileSync(tmpFile, fullCode);
    
    const pythonExe = getPythonExecutable();
    
    // Pass env vars for mode and params
    const childEnv = { 
      ...process.env, 
      SI_EXEC_MODE: envMode,
      SI_PARAMS: envParams
    };

    const pyProcess = spawn(pythonExe, [tmpFile], { env: childEnv });
    
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
      let schemaData = null;
      const lines = stdout.split('\n');
      const logs = lines.filter(line => {
        if (line.startsWith("__PLOTLY_DATA__:")) {
          try { plotlyData = JSON.parse(line.replace("__PLOTLY_DATA__:", '')); } catch(e) {}
          return false;
        }
        if (line.startsWith("__SCHEMA_JSON__:")) {
          try { schemaData = JSON.parse(line.replace("__SCHEMA_JSON__:", '')); } catch(e) {}
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
        res.json({ 
          logs, 
          plotlyData, 
          schemaData, // Return discovered schema
          timestamp: new Date().toLocaleTimeString() 
        });
      }
    });
  });
}
