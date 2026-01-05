
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { 
  MASTER_DB, SYSTEM_DB, NOTEBOOK_LIST_TABLE, PUBLISHED_APPS_TABLE, SHARE_SNAPSHOTS_TABLE, USER_SETTINGS_TABLE,
  LOCK_FILE, IS_DEBUG, DATASETS 
} from './common.js';

export const pools = new Map();

export function getPoolConfig(db = '') {
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

export async function getPool(dbName) {
  if (!pools.has(dbName)) {
    const pool = mysql.createPool(getPoolConfig(dbName));
    pools.set(dbName, pool);
  }
  return pools.get(dbName);
}

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

async function initMasterDatasets(rootConn) {
  console.log("Initializing Master Datasets...");
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${MASTER_DB}\``);
  const masterPool = await getPool(MASTER_DB);

  for (const ds of DATASETS) {
    const filePath = path.join(process.cwd(), 'datasets', ds.fileName);
    if (fs.existsSync(filePath)) {
      try {
        const sqlContent = fs.readFileSync(filePath, 'utf-8');
        await masterPool.query(sqlContent);
        console.log(`Loaded dataset: ${ds.name}`);
      } catch (e) {
        console.error(`Failed to load dataset ${ds.name}:`, e);
      }
    } else {
      console.warn(`Dataset file not found: ${filePath}`);
    }
  }
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
  
  // Initialize Master Datasets while we have root connection
  await initMasterDatasets(rootConn);

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

export async function initSystem() {
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

  // User Settings Table
  await sysPool.query(`
    CREATE TABLE IF NOT EXISTS \`${USER_SETTINGS_TABLE}\` (
      user_id VARCHAR(50) PRIMARY KEY,
      settings_json TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
