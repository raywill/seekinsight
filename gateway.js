
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
const LOCK_FILE = path.join(process.cwd(), '.init_lock');

function getPythonExecutable() {
  if (fs.existsSync(VENV_PYTHON)) {
    return VENV_PYTHON;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

const SYSTEM_DB = 'seekinsight';
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
    multipleStatements: true, // Enable multiple SQL statements execution
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

// --- Data Generation Logic ---

function generateFitnessData() {
  const personas = [
    { name: 'Bob', type: 'Overweight', baseWeight: 105, weightTrend: -0.05, baseFat: 32, baseWaist: 110, baseRHR: 85, baseSleep: 6, baseSteps: 3000, baseCals: 2800 },
    { name: 'Alice', type: 'Underweight', baseWeight: 42, weightTrend: 0.02, baseFat: 16, baseWaist: 60, baseRHR: 75, baseSleep: 7.5, baseSteps: 6000, baseCals: 1600 },
    { name: 'Charlie', type: 'OfficeWorker', baseWeight: 75, weightTrend: 0.01, baseFat: 24, baseWaist: 90, baseRHR: 78, baseSleep: 5.5, baseSteps: 2500, baseCals: 2400 },
    { name: 'David', type: 'Athlete', baseWeight: 78, weightTrend: 0, baseFat: 10, baseWaist: 75, baseRHR: 55, baseSleep: 8, baseSteps: 12000, baseCals: 3000 }
  ];

  const data = [];
  const today = new Date();
  
  // Generate 365 days of data
  for (let i = 365; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    personas.forEach(p => {
      // Add randomness and trends
      const dayOffset = 365 - i;
      const currentWeight = p.baseWeight + (dayOffset * p.weightTrend) + (Math.random() - 0.5);
      
      // Correlate metrics roughly
      const fat = p.baseFat + (Math.random() * 2 - 1) + (p.name === 'Bob' ? -0.02 * dayOffset : 0);
      const waist = p.baseWaist + (Math.random() - 0.5) + (p.name === 'Bob' ? -0.03 * dayOffset : 0);
      
      // Lifestyle volatility
      let sleep = p.baseSleep + (Math.random() * 3 - 1);
      if (sleep < 4) sleep = 4; if (sleep > 10) sleep = 10;
      
      let steps = p.baseSteps + (Math.random() * 4000 - 2000);
      if (steps < 500) steps = 500;

      let cals = p.baseCals + (Math.random() * 600 - 300);

      // Weekend spikes for Charlie (Office Worker)
      if (date.getDay() === 0 || date.getDay() === 6) {
        if (p.name === 'Charlie') {
          cals += 800; // Cheat day
          sleep += 3;  // Oversleep
        }
      }

      data.push({
        name: p.name,
        date: dateStr,
        weight_kg: Number(currentWeight.toFixed(1)),
        body_fat_pct: Number(fat.toFixed(1)),
        waist_cm: Number(waist.toFixed(1)),
        resting_heart_rate: Math.round(p.baseRHR + (Math.random() * 4 - 2)),
        sleep_hours: Number(sleep.toFixed(1)),
        steps: Math.round(steps),
        calories_kcal: Math.round(cals)
      });
    });
  }
  return data;
}

async function initDemoData(sysPool) {
  console.log("Initializing Demo Data...");
  const DEMO_DB_NAME = 'seekinsight_demo';
  const DEMO_NB_ID = 'demo_fitness_001';
  const DEMO_APP_ID = 'demo_app_001';

  const rootConn = await mysql.createConnection({
    host: process.env.MYSQL_IP || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || ''
  });

  // 1. Create DB
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DEMO_DB_NAME}\``);
  await rootConn.end();

  // 2. Create Table & Insert Data
  const demoPool = await getPool(DEMO_DB_NAME);
  await demoPool.query(`DROP TABLE IF EXISTS fitness_metrics`);
  await demoPool.query(`
    CREATE TABLE fitness_metrics (
      name VARCHAR(50),
      record_date DATE,
      weight_kg FLOAT COMMENT 'Body Weight in KG',
      body_fat_pct FLOAT COMMENT 'Body Fat Percentage',
      waist_cm FLOAT COMMENT 'Waist Circumference',
      resting_heart_rate INT COMMENT 'Resting BPM',
      sleep_hours FLOAT COMMENT 'Nightly Sleep Duration',
      steps INT COMMENT 'Daily Step Count',
      calories_kcal INT COMMENT 'Total Caloric Intake'
    )
  `);

  const fitnessData = generateFitnessData();
  const values = fitnessData.map(d => [d.name, d.date, d.weight_kg, d.body_fat_pct, d.waist_cm, d.resting_heart_rate, d.sleep_hours, d.steps, d.calories_kcal]);
  
  if (values.length > 0) {
    // Insert in batches of 500
    const batchSize = 500;
    for (let i = 0; i < values.length; i += batchSize) {
      const chunk = values.slice(i, i + batchSize);
      await demoPool.query(
        `INSERT INTO fitness_metrics (name, record_date, weight_kg, body_fat_pct, waist_cm, resting_heart_rate, sleep_hours, steps, calories_kcal) VALUES ?`,
        [chunk]
      );
    }
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

  // Create a realistic snapshot for the "lazy load" visual effect
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
         {
            type: "bar",
            xKey: "name",
            yKeys: ["avg_daily_steps"],
            title: "Activity Level by Person",
            description: "Average daily step count over the last year"
         },
         {
            type: "bar",
            xKey: "name",
            yKeys: ["avg_sleep"],
            title: "Sleep Quality Comparison",
            description: "Average nightly sleep hours"
         }
      ]
    },
    analysis: "### Health Analysis Summary\n\n**David (Athlete)** shows superior metrics across the board with >12k steps and ~8h sleep, supporting high caloric intake.\n\n**Charlie & Bob** show concerning indicators: low activity (<4k steps) and insufficient sleep (<6.5h), which correlates with higher BMI metrics in the raw data."
  };

  const demoPrompt = "Compare daily activity, sleep and calorie intake across all users.";

  await sysPool.query(
    `INSERT IGNORE INTO \`${PUBLISHED_APPS_TABLE}\` (id, title, description, prompt, author, type, code, source_db_name, source_notebook_id, snapshot_json, views) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 350)`,
    [
      DEMO_APP_ID, 
      'Yearly Health Habits Review', 
      'Comparative analysis of activity, sleep, and caloric intake across 4 different personas.', 
      demoPrompt,
      'SeekInsight Demo', 
      'SQL', 
      sqlCode, 
      DEMO_DB_NAME, 
      DEMO_NB_ID, 
      JSON.stringify(snapshot)
    ]
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      views INT DEFAULT 0
    )
  `);

  // Migration: Add views column to Notebooks if missing
  try {
    const [columns] = await sysPool.query(`SHOW COLUMNS FROM \`${NOTEBOOK_LIST_TABLE}\` LIKE 'views'`);
    if (columns.length === 0) {
      await sysPool.query(`ALTER TABLE \`${NOTEBOOK_LIST_TABLE}\` ADD COLUMN views INT DEFAULT 0`);
    }
  } catch (err) {}

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
    )
  `);

  // Share Snapshots Table
  await sysPool.query(`
    CREATE TABLE IF NOT EXISTS \`${SHARE_SNAPSHOTS_TABLE}\` (
      id VARCHAR(12) PRIMARY KEY,
      app_id VARCHAR(50),
      params_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add views column to Apps if missing
  try {
    const [columns] = await sysPool.query(`SHOW COLUMNS FROM \`${PUBLISHED_APPS_TABLE}\` LIKE 'views'`);
    if (columns.length === 0) {
      await sysPool.query(`ALTER TABLE \`${PUBLISHED_APPS_TABLE}\` ADD COLUMN views INT DEFAULT 0`);
    }
  } catch (err) {}

  try {
    const [columns] = await sysPool.query(`SHOW COLUMNS FROM \`${PUBLISHED_APPS_TABLE}\` LIKE 'source_notebook_id'`);
    if (columns.length === 0) {
        await sysPool.query(`ALTER TABLE \`${PUBLISHED_APPS_TABLE}\` ADD COLUMN source_notebook_id VARCHAR(50)`);
    }
  } catch (e) {}

  // Migration: Add prompt column to Apps if missing
  try {
    const [columns] = await sysPool.query(`SHOW COLUMNS FROM \`${PUBLISHED_APPS_TABLE}\` LIKE 'prompt'`);
    if (columns.length === 0) {
        await sysPool.query(`ALTER TABLE \`${PUBLISHED_APPS_TABLE}\` ADD COLUMN prompt TEXT`);
    }
  } catch (e) {}

  // IDEMPOTENT INITIALIZATION CHECK
  if (!fs.existsSync(LOCK_FILE)) {
    try {
      await initDemoData(sysPool);
      fs.writeFileSync(LOCK_FILE, new Date().toISOString());
      console.log("System initialized with demo data.");
    } catch (e) {
      console.error("Initialization Failed:", e);
      // Don't write lock file if failed, so it retries next time
    }
  }
}

// --- Share Snapshot API ---

app.post('/shares', async (req, res) => {
  try {
    const { appId, params } = req.body;
    if (!appId) return res.status(400).json({ message: 'App ID required' });
    
    // Generate a short 6-char ID
    const id = crypto.randomBytes(4).toString('hex').substring(0, 8); 
    
    const pool = await getPool(SYSTEM_DB);
    await pool.query(
      `INSERT INTO \`${SHARE_SNAPSHOTS_TABLE}\` (id, app_id, params_json) VALUES (?, ?, ?)`,
      [id, appId, JSON.stringify(params || {})]
    );
    
    res.json({ success: true, id });
  } catch (err) {
    console.error("[Shares POST Error]:", err);
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
    console.error("[Shares GET Error]:", err);
    res.status(500).json({ message: err.message });
  }
});

// --- Apps API ---

app.get('/apps', async (req, res) => {
  try {
    const pool = await getPool(SYSTEM_DB);
    // Updated: Order by created_at DESC strictly
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

// Increment App View
app.post('/apps/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool(SYSTEM_DB);
    await pool.query(`UPDATE \`${PUBLISHED_APPS_TABLE}\` SET views = views + 1 WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("[Apps View Increment Error]:", err);
    res.status(500).json({ message: err.message });
  }
});

// Create New App
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
    console.error("[Apps POST Error]:", err);
    res.status(500).json({ message: err.message });
  }
});

// Update Existing App
app.put('/apps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, prompt, author, type, code, source_db_name, source_notebook_id, params_schema, snapshot_json } = req.body;
    const pool = await getPool(SYSTEM_DB);

    const [existing] = await pool.query(`SELECT id FROM \`${PUBLISHED_APPS_TABLE}\` WHERE id = ?`, [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'App not found' });
    
    await pool.query(
      `UPDATE \`${PUBLISHED_APPS_TABLE}\` SET 
        title = ?, 
        description = ?, 
        prompt = ?, 
        author = ?, 
        type = ?, 
        code = ?, 
        source_db_name = ?, 
        source_notebook_id = ?, 
        params_schema = ?, 
        snapshot_json = ? 
      WHERE id = ?`,
      [title, description, prompt, author || 'User', type, code, source_db_name, source_notebook_id, params_schema, snapshot_json, id]
    );
    
    res.json({ success: true, id });
  } catch (err) {
    console.error("[Apps PUT Error]:", err);
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

// Increment Notebook View
app.post('/notebooks/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool(SYSTEM_DB);
    await pool.query(`UPDATE \`${NOTEBOOK_LIST_TABLE}\` SET views = views + 1 WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    if (IS_DEBUG) console.error("[Notebook View Increment Error]:", err);
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
      `INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, views) VALUES (?, ?, ?, ?, ?, 0)`,
      [id, dbName, '未命名主题', 0, randomIcon]
    );

    res.json({ id, db_name: dbName, topic: '未命名主题', icon_name: randomIcon, views: 0 });
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
            `INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, suggestions_json, views) VALUES (?, ?, ?, ?, ?, ?, 0)`,
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
    
    // 1. Delete Physical Database
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

    // 2. Cascading Delete: Delete any Apps derived from this Notebook
    await sysPool.query(`DELETE FROM \`${PUBLISHED_APPS_TABLE}\` WHERE source_notebook_id = ?`, [id]);

    // 3. Delete Notebook Entry
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
    // mysql2 with multipleStatements: true returns [rows, fields]
    // If multiple queries: rows is array of results, fields is array of fields
    const [result, fields] = await pool.query(sql);

    let activeRows = result;
    let activeFields = fields;
    
    let isMulti = false;
    for (let i = 0; i < fields.length; ++i) {
      if (Array.isArray(fields) && undefined === fields[i]) {
         isMulti = true
         break
      }
    }
    // 0. Only process the last query if is multi-statement
    if (isMulti) {
       activeRows = result[result.length - 1];
       activeFields = fields[fields.length - 1];
    }

    // 1. Handle Multi-Statement Execution
    // Scenario 1: Mixed SELECTs or Multiple SELECTs -> fields is [ [Field...], undefined, ... ]
    if (Array.isArray(fields) && Array.isArray(fields[fields.length - 1])) {
         // Grab the LAST result set
         activeRows = result[result.length - 1];
         activeFields = fields[fields.length - 1];
    }
    // Scenario 2: Multiple DMLs -> fields is undefined, result is [ResultSetHeader, ResultSetHeader...]
    // We detect this if result is an array of objects that have 'affectedRows'
    else if (!fields && Array.isArray(result) && result.length > 0 && ('affectedRows' in result[0])) {
         activeRows = result[result.length - 1];
    }

    // 2. Handle DML/DDL (Non-SELECT)
    // If activeRows is a ResultSetHeader (object with affectedRows), transform it into a visible table
    if (activeRows && 'affectedRows' in activeRows && !Array.isArray(activeRows)) {
         return res.json({
            rows: [{
                status: 'Success',
                message: activeRows.info || 'Query executed successfully',
                affected_rows: activeRows.affectedRows,
                insert_id: activeRows.insertId,
                warning_count: activeRows.warningStatus
            }],
            columns: ['status', 'message', 'affected_rows', 'insert_id', 'warning_count']
         });
    }

    // 3. Handle Standard SELECT
    // Standardize column extraction from FieldPackets
    const columns = activeFields ? activeFields.map(f => f.name) : (Array.isArray(activeRows) && activeRows.length > 0 ? Object.keys(activeRows[0]) : []);
    
    res.json({ rows: Array.isArray(activeRows) ? activeRows : [activeRows], columns });

  } catch (err) {
    if (IS_DEBUG) {
      console.error(`[SQL Error in ${dbName}]:`, err.message);
      console.error(`Query: ${sql}`);
    }
    res.status(500).json({ message: err.message });
  }
});

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

app.post('/log-prompt', (req, res) => res.sendStatus(200));

initSystem().then(() => {
  app.listen(PORT, () => console.log(`🚀 Gateway running at http://localhost:${PORT}`));
});
