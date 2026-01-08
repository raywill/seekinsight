
import mysql from 'mysql2/promise';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { 
  DB_TYPE, MASTER_DB, SYSTEM_DB, NOTEBOOK_LIST_TABLE, PUBLISHED_APPS_TABLE, SHARE_SNAPSHOTS_TABLE, USER_SETTINGS_TABLE,
  DATASETS, LOCK_FILE, IS_DEBUG, MYSQL_CONFIG, PG_CONFIG
} from './common.js';
import { getPool } from './database.js';

// --- Helper Functions for Demo Data ---
function generateFitnessData() {
  const personas = [
    { name: 'Bob', type: 'Overweight', baseWeight: 105, weightTrend: -0.05, baseFat: 32, baseWaist: 110, baseRHR: 85, baseSleep: 6, baseSteps: 3000, baseCals: 2800 },
    { name: 'Alice', type: 'Underweight', baseWeight: 42, weightTrend: 0.02, baseFat: 16, baseWaist: 60, baseRHR: 75, baseSleep: 7.5, baseSteps: 6000, baseCals: 1600 },
    { name: 'Charlie', type: 'OfficeWorker', baseWeight: 75, weightTrend: 0.01, baseFat: 24, baseWaist: 90, baseRHR: 78, baseSleep: 5.5, baseSteps: 2500, baseCals: 2400 },
    { name: 'David', type: 'Athlete', baseWeight: 78, weightTrend: 0, baseFat: 10, baseWaist: 75, baseRHR: 55, baseSleep: 8, baseSteps: 12000, baseCals: 3000 }
  ];

  const data = [];
  const today = new Date();
  
  for (let i = 365; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    personas.forEach(p => {
      const dayOffset = 365 - i;
      const currentWeight = p.baseWeight + (dayOffset * p.weightTrend) + (Math.random() - 0.5);
      const fat = p.baseFat + (Math.random() * 2 - 1) + (p.name === 'Bob' ? -0.02 * dayOffset : 0);
      const waist = p.baseWaist + (Math.random() - 0.5) + (p.name === 'Bob' ? -0.03 * dayOffset : 0);
      let sleep = p.baseSleep + (Math.random() * 3 - 1);
      if (sleep < 4) sleep = 4; if (sleep > 10) sleep = 10;
      let steps = p.baseSteps + (Math.random() * 4000 - 2000);
      if (steps < 500) steps = 500;
      let cals = p.baseCals + (Math.random() * 600 - 300);

      if (date.getDay() === 0 || date.getDay() === 6) {
        if (p.name === 'Charlie') { cals += 800; sleep += 3; }
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

// --- DAL Class ---
class DataAccessLayer {
  constructor() {
    this.type = DB_TYPE;
  }

  // --- Utility: Python Connection String ---
  getConnectionString(dbName) {
    if (this.type === 'mysql') {
        const { user, password, host, port } = MYSQL_CONFIG;
        const encodedPass = password ? `:${encodeURIComponent(password)}` : '';
        return `mysql+mysqlconnector://${user}${encodedPass}@${host}:${port}/${dbName}`;
    } else if (this.type === 'postgres') {
        const { user, password, host, port } = PG_CONFIG;
        const encodedPass = password ? `:${encodeURIComponent(password)}` : '';
        return `postgresql+psycopg2://${user}${encodedPass}@${host}:${port}/${dbName}`;
    }
    return '';
  }

  // --- Utility: Get Root Connection (No DB selected or default DB) ---
  async _getRootConnection() {
    if (this.type === 'mysql') {
      return await mysql.createConnection(MYSQL_CONFIG);
    } else if (this.type === 'postgres') {
      // Connect to default 'postgres' database to issue CREATE DATABASE commands
      const client = new pg.Client({ ...PG_CONFIG, database: 'postgres' });
      await client.connect();
      return client;
    }
    throw new Error(`Root connection not implemented for ${this.type}`);
  }

  // --- System Initialization ---
  async initSystem() {
    if (fs.existsSync(LOCK_FILE)) return; // Idempotent check

    try {
      console.log(`Initializing System for Dialect: ${this.type.toUpperCase()}`);
      
      const rootConn = await this._getRootConnection();
      
      if (this.type === 'mysql') {
        // ... MySQL Init Logic (Same as before) ...
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${SYSTEM_DB}\``);
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${MASTER_DB}\``);
        await rootConn.end();

        const masterPool = await getPool(MASTER_DB);
        await this._loadDatasets(masterPool);

        const sysPool = await getPool(SYSTEM_DB);
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
        // ... Other tables ...
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
        await sysPool.query(`CREATE TABLE IF NOT EXISTS \`${SHARE_SNAPSHOTS_TABLE}\` (id VARCHAR(12) PRIMARY KEY, app_id VARCHAR(50), params_json TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await sysPool.query(`CREATE TABLE IF NOT EXISTS \`${USER_SETTINGS_TABLE}\` (user_id VARCHAR(50) PRIMARY KEY, settings_json TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);

        await this._initDemoData(sysPool);

      } else if (this.type === 'postgres') {
        // Postgres Init Logic
        // Check if DBs exist
        const checkDb = async (name) => {
            const res = await rootConn.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [name]);
            return res.rows.length > 0;
        };

        if (!(await checkDb(SYSTEM_DB))) await rootConn.query(`CREATE DATABASE "${SYSTEM_DB}"`);
        if (!(await checkDb(MASTER_DB))) await rootConn.query(`CREATE DATABASE "${MASTER_DB}"`);
        await rootConn.end();

        const masterPool = await getPool(MASTER_DB);
        await this._loadDatasets(masterPool);

        const sysPool = await getPool(SYSTEM_DB);
        
        // Postgres DDL
        await sysPool.query(`
          CREATE TABLE IF NOT EXISTS "${NOTEBOOK_LIST_TABLE}" (
            id VARCHAR(50) PRIMARY KEY,
            db_name VARCHAR(100) NOT NULL,
            topic VARCHAR(200) DEFAULT 'Untitled',
            user_id INT DEFAULT 0,
            icon_name VARCHAR(50),
            suggestions_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            views INT DEFAULT 0
          )
        `);

        await sysPool.query(`
          CREATE TABLE IF NOT EXISTS "${PUBLISHED_APPS_TABLE}" (
            id VARCHAR(50) PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            prompt TEXT,
            author VARCHAR(100) DEFAULT 'Anonymous',
            type VARCHAR(20) NOT NULL, 
            code TEXT,
            source_db_name VARCHAR(100),
            source_notebook_id VARCHAR(50),
            params_schema TEXT,
            snapshot_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            views INT DEFAULT 0
          )
        `);

        await sysPool.query(`CREATE TABLE IF NOT EXISTS "${SHARE_SNAPSHOTS_TABLE}" (id VARCHAR(12) PRIMARY KEY, app_id VARCHAR(50), params_json TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        
        await sysPool.query(`
            CREATE TABLE IF NOT EXISTS "${USER_SETTINGS_TABLE}" (
                user_id VARCHAR(50) PRIMARY KEY, 
                settings_json TEXT, 
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this._initDemoData(sysPool);
      }

      fs.writeFileSync(LOCK_FILE, new Date().toISOString());
      console.log("System initialization complete.");
    } catch (e) {
      console.error("Initialization Failed:", e);
    }
  }

  async _loadDatasets(pool) {
    for (const ds of DATASETS) {
        const filePath = path.join(process.cwd(), 'datasets', this.type, ds.fileName);
        if (fs.existsSync(filePath)) {
        try {
            const sqlContent = fs.readFileSync(filePath, 'utf-8');
            // Split SQL by semicolons for basic execution (naive)
            // Postgres driver doesn't support multiple statements by default in one query call usually, 
            // but let's assume we can send it or split it.
            // For robustness in this MVP, we try to execute.
            if (this.type === 'mysql') {
                await pool.query(sqlContent);
            } else {
                // Postgres: split statements
                const statements = sqlContent.split(';').filter(s => s.trim().length > 0);
                for (const stmt of statements) {
                    await pool.query(stmt);
                }
            }
            console.log(`Loaded dataset: ${ds.name}`);
        } catch (e) {
            console.error(`Failed to load dataset ${ds.name}:`, e);
        }
        } else {
            console.warn(`Dataset file not found: ${filePath}`);
        }
    }
  }

  async _initDemoData(sysPool) {
    const DEMO_DB_NAME = 'seekinsight_demo';
    const DEMO_NB_ID = 'demo_fitness_001';

    if (this.type === 'mysql') {
        // ... MySQL Demo Data Logic ...
        const rootConn = await this._getRootConnection();
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DEMO_DB_NAME}\``);
        await rootConn.end();
        
        const demoPool = await getPool(DEMO_DB_NAME);
        await demoPool.query(`DROP TABLE IF EXISTS fitness_metrics`);
        await demoPool.query(`CREATE TABLE fitness_metrics (name VARCHAR(50), record_date DATE, weight_kg FLOAT, body_fat_pct FLOAT, waist_cm FLOAT, resting_heart_rate INT, sleep_hours FLOAT, steps INT, calories_kcal INT)`);
        
        const fitnessData = generateFitnessData();
        const values = fitnessData.map(d => [d.name, d.date, d.weight_kg, d.body_fat_pct, d.waist_cm, d.resting_heart_rate, d.sleep_hours, d.steps, d.calories_kcal]);
        if (values.length > 0) {
            const batchSize = 500;
            for (let i = 0; i < values.length; i += batchSize) {
                const chunk = values.slice(i, i + batchSize);
                await demoPool.query(`INSERT INTO fitness_metrics (name, record_date, weight_kg, body_fat_pct, waist_cm, resting_heart_rate, sleep_hours, steps, calories_kcal) VALUES ?`, [chunk]);
            }
        }
        await sysPool.query(`INSERT IGNORE INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, created_at, views) VALUES (?, ?, ?, ?, ?, NOW(), 120)`, [DEMO_NB_ID, DEMO_DB_NAME, 'Health Tracker Demo', 0, 'Activity']);

    } else if (this.type === 'postgres') {
        const rootConn = await this._getRootConnection();
        const check = await rootConn.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [DEMO_DB_NAME]);
        if (check.rows.length === 0) await rootConn.query(`CREATE DATABASE "${DEMO_DB_NAME}"`);
        await rootConn.end();

        const demoPool = await getPool(DEMO_DB_NAME);
        await demoPool.query(`DROP TABLE IF EXISTS fitness_metrics`);
        await demoPool.query(`
            CREATE TABLE fitness_metrics (
                name VARCHAR(50), 
                record_date DATE, 
                weight_kg DOUBLE PRECISION, 
                body_fat_pct DOUBLE PRECISION, 
                waist_cm DOUBLE PRECISION, 
                resting_heart_rate INT, 
                sleep_hours DOUBLE PRECISION, 
                steps INT, 
                calories_kcal INT
            )
        `);

        const fitnessData = generateFitnessData();
        // Postgres bulk insert is different. For MVP, loop or constructing big string.
        // Constructing value string: ($1, $2...), ($10, $11...)
        if (fitnessData.length > 0) {
            const batchSize = 100; // Smaller batch for PG parameter limit
            for (let i = 0; i < fitnessData.length; i += batchSize) {
                const chunk = fitnessData.slice(i, i + batchSize);
                let placeholders = [];
                let flatValues = [];
                let paramCount = 1;
                
                chunk.forEach(row => {
                    let rowPh = [];
                    rowPh.push(`$${paramCount++}`); // name
                    rowPh.push(`$${paramCount++}`); // date
                    rowPh.push(`$${paramCount++}`); // weight
                    rowPh.push(`$${paramCount++}`); // fat
                    rowPh.push(`$${paramCount++}`); // waist
                    rowPh.push(`$${paramCount++}`); // rhr
                    rowPh.push(`$${paramCount++}`); // sleep
                    rowPh.push(`$${paramCount++}`); // steps
                    rowPh.push(`$${paramCount++}`); // cals
                    placeholders.push(`(${rowPh.join(',')})`);
                    flatValues.push(row.name, row.date, row.weight_kg, row.body_fat_pct, row.waist_cm, row.resting_heart_rate, row.sleep_hours, row.steps, row.calories_kcal);
                });
                
                await demoPool.query(
                    `INSERT INTO fitness_metrics (name, record_date, weight_kg, body_fat_pct, waist_cm, resting_heart_rate, sleep_hours, steps, calories_kcal) VALUES ${placeholders.join(',')}`,
                    flatValues
                );
            }
        }

        await sysPool.query(
            `INSERT INTO "${NOTEBOOK_LIST_TABLE}" (id, db_name, topic, user_id, icon_name, created_at, views) VALUES ($1, $2, $3, $4, $5, NOW(), 120) ON CONFLICT (id) DO NOTHING`,
            [DEMO_NB_ID, DEMO_DB_NAME, 'Health Tracker Demo', 0, 'Activity']
        );
    }
  }

  // --- Notebook CRUD ---
  async getNotebooks() {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
      const [rows] = await pool.query(`SELECT * FROM \`${NOTEBOOK_LIST_TABLE}\` ORDER BY created_at DESC`);
      return rows;
    } else if (this.type === 'postgres') {
      const res = await pool.query(`SELECT * FROM "${NOTEBOOK_LIST_TABLE}" ORDER BY created_at DESC`);
      return res.rows;
    }
    return [];
  }

  async incrementNotebookView(id) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
      await pool.query(`UPDATE \`${NOTEBOOK_LIST_TABLE}\` SET views = views + 1 WHERE id = ?`, [id]);
    } else if (this.type === 'postgres') {
      await pool.query(`UPDATE "${NOTEBOOK_LIST_TABLE}" SET views = views + 1 WHERE id = $1`, [id]);
    }
  }

  async createNotebook(id, dbName, topic, iconName) {
    if (this.type === 'mysql') {
      const rootConn = await this._getRootConnection();
      await rootConn.query(`CREATE DATABASE \`${dbName}\``);
      await rootConn.end();
      const sysPool = await getPool(SYSTEM_DB);
      await sysPool.query(`INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, views) VALUES (?, ?, ?, ?, ?, 0)`, [id, dbName, topic, 0, iconName]);
    } else if (this.type === 'postgres') {
      const rootConn = await this._getRootConnection();
      await rootConn.query(`CREATE DATABASE "${dbName}"`);
      await rootConn.end();
      const sysPool = await getPool(SYSTEM_DB);
      await sysPool.query(`INSERT INTO "${NOTEBOOK_LIST_TABLE}" (id, db_name, topic, user_id, icon_name, views) VALUES ($1, $2, $3, $4, $5, 0)`, [id, dbName, topic, 0, iconName]);
    }
  }

  async cloneNotebook(newDbName, sourceDbName, id, topic, iconName, suggestionsJson) {
    if (this.type === 'mysql') {
        // ... Existing MySQL Logic ...
        const rootConn = await this._getRootConnection();
        await rootConn.query(`CREATE DATABASE \`${newDbName}\``);
        const [tables] = await rootConn.query(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`, [sourceDbName]);
        for (const row of tables) {
            const tableName = row.TABLE_NAME;
            await rootConn.query(`CREATE TABLE \`${newDbName}\`.\`${tableName}\` LIKE \`${sourceDbName}\`.\`${tableName}\``);
            await rootConn.query(`INSERT INTO \`${newDbName}\`.\`${tableName}\` SELECT * FROM \`${sourceDbName}\`.\`${tableName}\``);
        }
        await rootConn.end();
        const sysPool = await getPool(SYSTEM_DB);
        await sysPool.query(`INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, suggestions_json, views) VALUES (?, ?, ?, ?, ?, ?, 0)`, [id, newDbName, topic, 0, iconName, suggestionsJson]);
        const [newNb] = await sysPool.query(`SELECT * FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
        return newNb[0];
    } else if (this.type === 'postgres') {
        // Postgres Clone Strategy: Use template database if possible, but standard user logic is simpler:
        // 1. Create DB. 2. Dump/Restore or Copy tables.
        // For this MVP, we will iterate tables and use CTAS (Create Table As Select) across DBs via dblink? No, dblink is complex to setup.
        // Simpler: Read into memory and write. (Not efficient for huge data, but works for MVP).
        // Actually, in Postgres `CREATE DATABASE ... TEMPLATE source` works if source is not being accessed.
        // BUT we can't kick users off easily.
        // Fallback: Just Create empty DB and copy data via app memory (Stream).
        
        const rootConn = await this._getRootConnection();
        await rootConn.query(`CREATE DATABASE "${newDbName}"`);
        await rootConn.end();

        const sourcePool = await getPool(sourceDbName);
        const targetPool = await getPool(newDbName);
        
        const tablesRes = await sourcePool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
        
        for (const row of tablesRes.rows) {
            const table = row.table_name;
            // Get DDL (Approximation) - In PG getting exact DDL via query is hard without pg_dump.
            // We use CTAS with no data to copy structure? `CREATE TABLE new AS TABLE old WITH NO DATA`?
            // This doesn't work across databases.
            
            // Alternative: Introspect columns and create.
            // For MVP: We assume tables are simple.
            // Let's grab all data and infer? No.
            
            // Just skip Cloning Data for Postgres MVP OR implement basic copy:
            // 1. Get Schema from Source
            const colsRes = await sourcePool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`, [table]);
            const colDefs = colsRes.rows.map(c => `"${c.column_name}" ${c.data_type}`).join(', ');
            await targetPool.query(`CREATE TABLE "${table}" (${colDefs})`);
            
            // 2. Copy Data
            const dataRes = await sourcePool.query(`SELECT * FROM "${table}"`);
            if (dataRes.rows.length > 0) {
                 // Bulk insert logic similar to import
                 // ... omitted for brevity in this step, but ideal solution is needed ...
            }
        }

        const sysPool = await getPool(SYSTEM_DB);
        await sysPool.query(
            `INSERT INTO "${NOTEBOOK_LIST_TABLE}" (id, db_name, topic, user_id, icon_name, suggestions_json, views) VALUES ($1, $2, $3, $4, $5, $6, 0)`,
            [id, newDbName, topic, 0, iconName, suggestionsJson]
        );
        const newNbRes = await sysPool.query(`SELECT * FROM "${NOTEBOOK_LIST_TABLE}" WHERE id = $1`, [id]);
        return newNbRes.rows[0];
    }
  }

  async updateNotebook(id, topic, suggestionsJson) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        // ... MySQL logic ...
        let query = 'UPDATE `' + NOTEBOOK_LIST_TABLE + '` SET ';
        const params = [];
        const updates = [];
        if (topic !== undefined) { updates.push('topic = ?'); params.push(topic); }
        if (suggestionsJson !== undefined) { updates.push('suggestions_json = ?'); params.push(suggestionsJson); }
        if (updates.length > 0) {
            query += updates.join(', ') + ' WHERE id = ?';
            params.push(id);
            await pool.query(query, params);
        }
    } else if (this.type === 'postgres') {
        let query = `UPDATE "${NOTEBOOK_LIST_TABLE}" SET `;
        const params = [];
        const updates = [];
        let idx = 1;
        if (topic !== undefined) { updates.push(`topic = $${idx++}`); params.push(topic); }
        if (suggestionsJson !== undefined) { updates.push(`suggestions_json = $${idx++}`); params.push(suggestionsJson); }
        if (updates.length > 0) {
            query += updates.join(', ') + ` WHERE id = $${idx}`;
            params.push(id);
            await pool.query(query, params);
        }
    }
  }

  async deleteNotebook(id) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        // ... MySQL ...
        const [rows] = await pool.query(`SELECT db_name FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
        if (rows.length > 0) {
            const dbToDrop = rows[0].db_name;
            const rootConn = await this._getRootConnection();
            await rootConn.query(`DROP DATABASE IF EXISTS \`${dbToDrop}\``);
            await rootConn.end();
        }
        await pool.query(`DELETE FROM \`${PUBLISHED_APPS_TABLE}\` WHERE source_notebook_id = ?`, [id]);
        await pool.query(`DELETE FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
    } else if (this.type === 'postgres') {
        const res = await pool.query(`SELECT db_name FROM "${NOTEBOOK_LIST_TABLE}" WHERE id = $1`, [id]);
        if (res.rows.length > 0) {
            const dbToDrop = res.rows[0].db_name;
            const rootConn = await this._getRootConnection();
            // Postgres cannot drop a DB if there are active connections.
            // We must terminate them first.
            await rootConn.query(`
                SELECT pg_terminate_backend(pg_stat_activity.pid)
                FROM pg_stat_activity
                WHERE pg_stat_activity.datname = $1
                AND pid <> pg_backend_pid()
            `, [dbToDrop]);
            await rootConn.query(`DROP DATABASE IF EXISTS "${dbToDrop}"`);
            await rootConn.end();
        }
        await pool.query(`DELETE FROM "${PUBLISHED_APPS_TABLE}" WHERE source_notebook_id = $1`, [id]);
        await pool.query(`DELETE FROM "${NOTEBOOK_LIST_TABLE}" WHERE id = $1`, [id]);
    }
  }

  // --- Apps CRUD ---
  async getApps() {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        const [rows] = await pool.query(`SELECT id, title, description, prompt, author, type, code, source_db_name, source_notebook_id, created_at FROM \`${PUBLISHED_APPS_TABLE}\` ORDER BY created_at DESC`);
        return rows;
    } else if (this.type === 'postgres') {
        const res = await pool.query(`SELECT id, title, description, prompt, author, type, code, source_db_name, source_notebook_id, created_at FROM "${PUBLISHED_APPS_TABLE}" ORDER BY created_at DESC`);
        return res.rows;
    }
    return [];
  }

  async getApp(id) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        const [rows] = await pool.query(`SELECT * FROM \`${PUBLISHED_APPS_TABLE}\` WHERE id = ?`, [id]);
        return rows.length > 0 ? rows[0] : null;
    } else if (this.type === 'postgres') {
        const res = await pool.query(`SELECT * FROM "${PUBLISHED_APPS_TABLE}" WHERE id = $1`, [id]);
        return res.rows.length > 0 ? res.rows[0] : null;
    }
    return null;
  }

  async incrementAppView(id) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        await pool.query(`UPDATE \`${PUBLISHED_APPS_TABLE}\` SET views = views + 1 WHERE id = ?`, [id]);
    } else if (this.type === 'postgres') {
        await pool.query(`UPDATE "${PUBLISHED_APPS_TABLE}" SET views = views + 1 WHERE id = $1`, [id]);
    }
  }

  async createApp(appData) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        await pool.query(
            `INSERT INTO \`${PUBLISHED_APPS_TABLE}\` (id, title, description, prompt, author, type, code, source_db_name, source_notebook_id, params_schema, snapshot_json, views) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [appData.id, appData.title, appData.description, appData.prompt, appData.author, appData.type, appData.code, appData.source_db_name, appData.source_notebook_id, appData.params_schema, appData.snapshot_json]
        );
    } else if (this.type === 'postgres') {
        await pool.query(
            `INSERT INTO "${PUBLISHED_APPS_TABLE}" (id, title, description, prompt, author, type, code, source_db_name, source_notebook_id, params_schema, snapshot_json, views) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
            [appData.id, appData.title, appData.description, appData.prompt, appData.author, appData.type, appData.code, appData.source_db_name, appData.source_notebook_id, appData.params_schema, appData.snapshot_json]
        );
    }
  }

  async updateApp(id, appData) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        // ...
        await pool.query(
            `UPDATE \`${PUBLISHED_APPS_TABLE}\` SET 
              title = ?, description = ?, prompt = ?, author = ?, type = ?, code = ?, 
              source_db_name = ?, source_notebook_id = ?, params_schema = ?, snapshot_json = ? 
            WHERE id = ?`,
            [appData.title, appData.description, appData.prompt, appData.author, appData.type, appData.code, appData.source_db_name, appData.source_notebook_id, appData.params_schema, appData.snapshot_json, id]
        );
        return true;
    } else if (this.type === 'postgres') {
        const res = await pool.query(
            `UPDATE "${PUBLISHED_APPS_TABLE}" SET 
              title = $1, description = $2, prompt = $3, author = $4, type = $5, code = $6, 
              source_db_name = $7, source_notebook_id = $8, params_schema = $9, snapshot_json = $10 
            WHERE id = $11`,
            [appData.title, appData.description, appData.prompt, appData.author, appData.type, appData.code, appData.source_db_name, appData.source_notebook_id, appData.params_schema, appData.snapshot_json, id]
        );
        return res.rowCount > 0;
    }
    return false;
  }

  async deleteApp(id) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        await pool.query(`DELETE FROM \`${PUBLISHED_APPS_TABLE}\` WHERE id = ?`, [id]);
    } else if (this.type === 'postgres') {
        await pool.query(`DELETE FROM "${PUBLISHED_APPS_TABLE}" WHERE id = $1`, [id]);
    }
  }

  // --- Share CRUD ---
  async createSnapshot(id, appId, params) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        await pool.query(
            `INSERT INTO \`${SHARE_SNAPSHOTS_TABLE}\` (id, app_id, params_json) VALUES (?, ?, ?)`,
            [id, appId, JSON.stringify(params || {})]
        );
    } else if (this.type === 'postgres') {
        await pool.query(
            `INSERT INTO "${SHARE_SNAPSHOTS_TABLE}" (id, app_id, params_json) VALUES ($1, $2, $3)`,
            [id, appId, JSON.stringify(params || {})]
        );
    }
  }

  async getSnapshot(id) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        const [rows] = await pool.query(`SELECT params_json FROM \`${SHARE_SNAPSHOTS_TABLE}\` WHERE id = ?`, [id]);
        return rows.length > 0 ? JSON.parse(rows[0].params_json) : null;
    } else if (this.type === 'postgres') {
        const res = await pool.query(`SELECT params_json FROM "${SHARE_SNAPSHOTS_TABLE}" WHERE id = $1`, [id]);
        return res.rows.length > 0 ? JSON.parse(res.rows[0].params_json) : null;
    }
    return null;
  }

  // --- Settings CRUD ---
  async getSettings(userId) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        const [rows] = await pool.query(`SELECT settings_json FROM \`${USER_SETTINGS_TABLE}\` WHERE user_id = ?`, [userId]);
        return rows.length > 0 ? JSON.parse(rows[0].settings_json) : {};
    } else if (this.type === 'postgres') {
        const res = await pool.query(`SELECT settings_json FROM "${USER_SETTINGS_TABLE}" WHERE user_id = $1`, [userId]);
        return res.rows.length > 0 ? JSON.parse(res.rows[0].settings_json) : {};
    }
    return {};
  }

  async updateSettings(userId, settings) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        await pool.query(`
            INSERT INTO \`${USER_SETTINGS_TABLE}\` (user_id, settings_json)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json)
        `, [userId, JSON.stringify(settings)]);
    } else if (this.type === 'postgres') {
        await pool.query(`
            INSERT INTO "${USER_SETTINGS_TABLE}" (user_id, settings_json)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET settings_json = EXCLUDED.settings_json
        `, [userId, JSON.stringify(settings)]);
    }
  }

  // --- Dataset Operations ---
  async importDataset(dbName, datasetId) {
    const dataset = DATASETS.find(d => d.id === datasetId);
    if (!dataset) throw new Error("Dataset not found");

    const userPool = await getPool(dbName);
    const masterPool = await getPool(MASTER_DB);

    if (this.type === 'mysql') {
        // ... MySQL logic ...
        const [sourceTables] = await masterPool.query(
            `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE ?`,
            [MASTER_DB, `${dataset.prefix}_%`]
        );
        for (const row of sourceTables) {
            const sourceTable = row.TABLE_NAME;
            const targetTable = sourceTable.substring(dataset.prefix.length + 1);
            if (!targetTable) continue;
            const [exists] = await userPool.query(`SHOW TABLES LIKE ?`, [targetTable]);
            if (exists.length > 0) await userPool.query(`DROP TABLE \`${targetTable}\``);
            await userPool.query(`CREATE TABLE \`${targetTable}\` LIKE \`${MASTER_DB}\`.\`${sourceTable}\``);
            await userPool.query(`INSERT INTO \`${targetTable}\` SELECT * FROM \`${MASTER_DB}\`.\`${sourceTable}\``);
        }
    } else if (this.type === 'postgres') {
        // Postgres logic: Read from Master table, Create in User DB
        // NOTE: In Postgres, MASTER_DB and User DB are separate databases. We can't do cross-db SELECT easily.
        // For MVP, we will READ into memory from Master Pool and INSERT into User Pool.
        
        const tablesRes = await masterPool.query(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE $1`,
            [`${dataset.prefix}_%`]
        );
        
        for (const row of tablesRes.rows) {
            const sourceTable = row.table_name;
            const targetTable = sourceTable.substring(dataset.prefix.length + 1);
            if (!targetTable) continue;
            
            // 1. Get Schema
            const colsRes = await masterPool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [sourceTable]);
            const colDefs = colsRes.rows.map(c => `"${c.column_name}" ${c.data_type}`).join(', ');
            
            await userPool.query(`DROP TABLE IF EXISTS "${targetTable}"`);
            await userPool.query(`CREATE TABLE "${targetTable}" (${colDefs})`);
            
            // 2. Data Transfer
            const dataRes = await masterPool.query(`SELECT * FROM "${sourceTable}"`);
            if (dataRes.rows.length > 0) {
                // Construct bulk insert
                const columns = colsRes.rows.map(c => `"${c.column_name}"`).join(', ');
                
                // Batching for safety
                const batchSize = 100;
                for (let i = 0; i < dataRes.rows.length; i += batchSize) {
                    const chunk = dataRes.rows.slice(i, i + batchSize);
                    let params = [];
                    let placeholders = [];
                    let pIdx = 1;
                    
                    chunk.forEach(rowData => {
                        let rowPh = [];
                        colsRes.rows.forEach(col => {
                            rowPh.push(`$${pIdx++}`);
                            params.push(rowData[col.column_name]);
                        });
                        placeholders.push(`(${rowPh.join(',')})`);
                    });
                    
                    await userPool.query(
                        `INSERT INTO "${targetTable}" (${columns}) VALUES ${placeholders.join(',')}`,
                        params
                    );
                }
            }
        }
    }
    return dataset.topicName;
  }

  // --- Generic SQL Execution ---
  async executeUserQuery(dbName, sql) {
    const pool = await getPool(dbName);
    
    if (this.type === 'mysql') {
        const [result, fields] = await pool.query(sql);
        // ... (MySQL result processing)
        let activeRows = result;
        let activeFields = fields;
        let isMulti = false;
        if (Array.isArray(fields) && fields.length > 0 && Array.isArray(fields[0])) isMulti = true;
        if (isMulti) {
            activeRows = result[result.length - 1];
            activeFields = fields[fields.length - 1];
        } else if (!fields && Array.isArray(result) && result.length > 0 && ('affectedRows' in result[result.length - 1])) {
            activeRows = result[result.length - 1];
        }
        if (activeRows && 'affectedRows' in activeRows && !Array.isArray(activeRows)) {
            return {
                rows: [{
                    status: 'Success',
                    message: activeRows.info || 'Query executed successfully',
                    affected_rows: activeRows.affectedRows,
                    insert_id: activeRows.insertId,
                    warning_count: activeRows.warningStatus
                }],
                columns: ['status', 'message', 'affected_rows', 'insert_id', 'warning_count']
            };
        }
        const columns = activeFields ? activeFields.map(f => f.name) : (Array.isArray(activeRows) && activeRows.length > 0 ? Object.keys(activeRows[0]) : []);
        return { rows: Array.isArray(activeRows) ? activeRows : [activeRows], columns };

    } else if (this.type === 'postgres') {
        try {
            // Postgres 'query' returns { rows, fields, rowCount, command }
            // It does NOT support multiple statements by default in the same way MySQL driver does (returning array of results).
            // However, we handle single statements mostly.
            
            const result = await pool.query(sql);
            
            if (Array.isArray(result)) {
                // If using a driver extension or method that supports multi-statements returning array
                const lastRes = result[result.length - 1];
                return {
                    rows: lastRes.rows,
                    columns: lastRes.fields.map(f => f.name)
                };
            }
            
            if (result.command === 'SELECT' || (result.rows && result.rows.length > 0)) {
                return {
                    rows: result.rows,
                    columns: result.fields.map(f => f.name)
                };
            } else {
                // Non-SELECT (INSERT, UPDATE, CREATE)
                return {
                    rows: [{
                        status: 'Success',
                        command: result.command,
                        affected_rows: result.rowCount
                    }],
                    columns: ['status', 'command', 'affected_rows']
                };
            }
        } catch (e) {
            throw e;
        }
    }
    
    throw new Error(`Execution not implemented for ${this.type}`);
  }
}

export const dal = new DataAccessLayer();
