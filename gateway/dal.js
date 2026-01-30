
import mysql from 'mysql2/promise';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { 
  DB_TYPE, MASTER_DB, SYSTEM_DB, NOTEBOOK_LIST_TABLE, PUBLISHED_APPS_TABLE, SHARE_SNAPSHOTS_TABLE, USER_SETTINGS_TABLE,
  DATASETS, LOCK_FILE, IS_DEBUG, MYSQL_CONFIG, PG_CONFIG, PG_URL
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

// --- Helper: Postgres Schema Fetcher ---
const getPgTableSchema = async (pool, tableName) => {
    const res = await pool.query(`
        SELECT
            a.attname as column_name,
            pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
            d.description as column_comment
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
        JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
        LEFT JOIN pg_catalog.pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
        WHERE n.nspname = 'public'
          AND c.relname = $1
          AND a.attnum > 0    -- Exclude system columns
          AND NOT a.attisdropped -- Exclude dropped columns
        ORDER BY a.attnum;
    `, [tableName]);
    return res.rows;
};

// --- DAL Class ---
class DataAccessLayer {
  constructor() {
    this.type = DB_TYPE;
  }

  // --- Utility: Python Connection String ---
  getConnectionString(dbName) {
    if (dbName.includes('://')) {
        // Adapt URI for Python SQLAlchemy
        if (dbName.startsWith('mysql://')) return dbName.replace('mysql://', 'mysql+mysqlconnector://');
        if (dbName.startsWith('postgres://')) return dbName.replace('postgres://', 'postgresql+psycopg2://');
        if (dbName.startsWith('postgresql://')) return dbName.replace('postgresql://', 'postgresql+psycopg2://');
        return dbName;
    }

    if (this.type === 'mysql') {
        const { user, password, host, port } = MYSQL_CONFIG;
        const encodedPass = password ? `:${encodeURIComponent(password)}` : '';
        return `mysql+mysqlconnector://${user}${encodedPass}@${host}:${port}/${dbName}`;
    } else if (this.type === 'postgres') {
        if (PG_URL) {
            try {
                const url = new URL(PG_URL);
                url.pathname = `/${dbName}`;
                let pyUrl = url.toString();
                // Ensure correct driver for SQLAlchemy
                if (pyUrl.startsWith('postgres://')) pyUrl = pyUrl.replace('postgres://', 'postgresql+psycopg2://');
                else if (pyUrl.startsWith('postgresql://')) pyUrl = pyUrl.replace('postgresql://', 'postgresql+psycopg2://');
                return pyUrl;
            } catch (e) {
                console.warn("Failed to parse PG_URL for Python, falling back to component config");
            }
        }
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
      let clientConfig;
      if (PG_URL) {
          clientConfig = { 
              connectionString: PG_URL, 
              ssl: { rejectUnauthorized: false },
              connectionTimeoutMillis: 10000 // Add timeout for root client too
          };
      } else {
          // Connect to default 'postgres' database to issue CREATE DATABASE commands
          clientConfig = { 
              ...PG_CONFIG, 
              database: 'postgres',
              connectionTimeoutMillis: 10000
          };
      }
      const client = new pg.Client(clientConfig);
      await client.connect();
      return client;
    }
    throw new Error(`Root connection not implemented for ${this.type}`);
  }

  // --- System Initialization ---
  async initSystem() {
    if (fs.existsSync(LOCK_FILE)) return; 

    try {
      console.log(`Initializing System for Dialect: ${this.type.toUpperCase()}`);
      
      const rootConn = await this._getRootConnection();
      
      if (this.type === 'mysql') {
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${SYSTEM_DB}\``);
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${MASTER_DB}\``);
        await rootConn.end();

        const masterPool = await getPool(MASTER_DB);
        await this._loadDatasets(masterPool);

        const sysPool = await getPool(SYSTEM_DB);
        await sysPool.query(`
          CREATE TABLE IF NOT EXISTS \`${NOTEBOOK_LIST_TABLE}\` (
            id VARCHAR(50) PRIMARY KEY,
            db_name TEXT NOT NULL, -- Migrated to TEXT for long URIs
            topic VARCHAR(200) DEFAULT '未命名主题',
            user_id INT DEFAULT 0,
            icon_name VARCHAR(50),
            suggestions_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            views INT DEFAULT 0,
            is_db_owner BOOLEAN DEFAULT 1
          )
        `);
        
        // Migration supports
        try { await sysPool.query(`ALTER TABLE \`${NOTEBOOK_LIST_TABLE}\` MODIFY COLUMN db_name TEXT NOT NULL`); } catch(e) {}
        try { await sysPool.query(`ALTER TABLE \`${NOTEBOOK_LIST_TABLE}\` ADD COLUMN is_db_owner BOOLEAN DEFAULT 1`); } catch (e) {}

        await sysPool.query(`
          CREATE TABLE IF NOT EXISTS \`${PUBLISHED_APPS_TABLE}\` (
            id VARCHAR(50) PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            prompt TEXT,
            author VARCHAR(100) DEFAULT 'Anonymous',
            type VARCHAR(20) NOT NULL, 
            code MEDIUMTEXT,
            source_db_name TEXT, -- TEXT for URIs
            source_notebook_id VARCHAR(50),
            params_schema TEXT,
            snapshot_json LONGTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            views INT DEFAULT 0
          )
        `);
        // App migration support
        try { await sysPool.query(`ALTER TABLE \`${PUBLISHED_APPS_TABLE}\` MODIFY COLUMN source_db_name TEXT`); } catch(e) {}

        await sysPool.query(`CREATE TABLE IF NOT EXISTS \`${SHARE_SNAPSHOTS_TABLE}\` (id VARCHAR(12) PRIMARY KEY, app_id VARCHAR(50), params_json TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await sysPool.query(`CREATE TABLE IF NOT EXISTS \`${USER_SETTINGS_TABLE}\` (user_id VARCHAR(50) PRIMARY KEY, settings_json TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);

        await this._initDemoData(sysPool);

      } else if (this.type === 'postgres') {
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
        
        await sysPool.query(`
          CREATE TABLE IF NOT EXISTS "${NOTEBOOK_LIST_TABLE}" (
            id VARCHAR(50) PRIMARY KEY,
            db_name TEXT NOT NULL,
            topic VARCHAR(200) DEFAULT 'Untitled',
            user_id INT DEFAULT 0,
            icon_name VARCHAR(50),
            suggestions_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            views INT DEFAULT 0,
            is_db_owner BOOLEAN DEFAULT TRUE
          )
        `);
        
        try { await sysPool.query(`ALTER TABLE "${NOTEBOOK_LIST_TABLE}" ALTER COLUMN db_name TYPE TEXT`); } catch(e) {}
        try { await sysPool.query(`ALTER TABLE "${NOTEBOOK_LIST_TABLE}" ADD COLUMN is_db_owner BOOLEAN DEFAULT TRUE`); } catch (e) {}

        await sysPool.query(`
          CREATE TABLE IF NOT EXISTS "${PUBLISHED_APPS_TABLE}" (
            id VARCHAR(50) PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            prompt TEXT,
            author VARCHAR(100) DEFAULT 'Anonymous',
            type VARCHAR(20) NOT NULL, 
            code TEXT,
            source_db_name TEXT,
            source_notebook_id VARCHAR(50),
            params_schema TEXT,
            snapshot_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            views INT DEFAULT 0
          )
        `);
        try { await sysPool.query(`ALTER TABLE "${PUBLISHED_APPS_TABLE}" ALTER COLUMN source_db_name TYPE TEXT`); } catch(e) {}

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
      if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
    }
  }

  // --- Databases Listing ---
  async getDatabases() {
    const rootConn = await this._getRootConnection();
    try {
        if (this.type === 'mysql') {
            const [rows] = await rootConn.query(`SHOW DATABASES`);
            const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys', SYSTEM_DB, MASTER_DB];
            return rows.map(r => r.Database).filter(db => !systemDbs.includes(db));
        } else if (this.type === 'postgres') {
            const res = await rootConn.query(`SELECT datname FROM pg_database WHERE datistemplate = false`);
            const systemDbs = ['postgres', SYSTEM_DB, MASTER_DB];
            return res.rows.map(r => r.datname).filter(db => !systemDbs.includes(db));
        }
    } finally {
        await rootConn.end();
    }
    return [];
  }

  // ... (Rest of the file remains unchanged)
  async _loadDatasets(pool) {
    for (const ds of DATASETS) {
        const filePath = path.join(process.cwd(), 'datasets', this.type, ds.fileName);
        if (fs.existsSync(filePath)) {
        try {
            const sqlContent = fs.readFileSync(filePath, 'utf-8');
            if (this.type === 'mysql') {
                await pool.query(sqlContent);
            } else {
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
        await sysPool.query(`INSERT IGNORE INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, created_at, views, is_db_owner) VALUES (?, ?, ?, ?, ?, NOW(), 120, 1)`, [DEMO_NB_ID, DEMO_DB_NAME, 'Health Tracker Demo', 0, 'Activity']);

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
        if (fitnessData.length > 0) {
            const batchSize = 100;
            for (let i = 0; i < fitnessData.length; i += batchSize) {
                const chunk = fitnessData.slice(i, i + batchSize);
                let placeholders = [];
                let flatValues = [];
                let paramCount = 1;
                
                chunk.forEach(row => {
                    let rowPh = [];
                    rowPh.push(`$${paramCount++}`);
                    rowPh.push(`$${paramCount++}`);
                    rowPh.push(`$${paramCount++}`);
                    rowPh.push(`$${paramCount++}`);
                    rowPh.push(`$${paramCount++}`);
                    rowPh.push(`$${paramCount++}`);
                    rowPh.push(`$${paramCount++}`);
                    rowPh.push(`$${paramCount++}`);
                    rowPh.push(`$${paramCount++}`);
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
            `INSERT INTO "${NOTEBOOK_LIST_TABLE}" (id, db_name, topic, user_id, icon_name, created_at, views, is_db_owner) VALUES ($1, $2, $3, $4, $5, NOW(), 120, TRUE) ON CONFLICT (id) DO NOTHING`,
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
      await sysPool.query(`INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, views, is_db_owner) VALUES (?, ?, ?, ?, ?, 0, 1)`, [id, dbName, topic, 0, iconName]);
    } else if (this.type === 'postgres') {
      const rootConn = await this._getRootConnection();
      await rootConn.query(`CREATE DATABASE "${dbName}"`);
      await rootConn.end();
      const sysPool = await getPool(SYSTEM_DB);
      await sysPool.query(`INSERT INTO "${NOTEBOOK_LIST_TABLE}" (id, db_name, topic, user_id, icon_name, views, is_db_owner) VALUES ($1, $2, $3, $4, $5, 0, TRUE)`, [id, dbName, topic, 0, iconName]);
    }
  }

  async cloneNotebook(newDbName, sourceDbName, id, topic, iconName, suggestionsJson) {
    if (this.type === 'mysql') {
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
        await sysPool.query(`INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, suggestions_json, views, is_db_owner) VALUES (?, ?, ?, ?, ?, ?, 0, 1)`, [id, newDbName, topic, 0, iconName, suggestionsJson]);
        const [newNb] = await sysPool.query(`SELECT * FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
        return newNb[0];
    } else if (this.type === 'postgres') {
        const rootConn = await this._getRootConnection();
        await rootConn.query(`CREATE DATABASE "${newDbName}"`);
        await rootConn.end();

        const sourcePool = await getPool(sourceDbName);
        const targetPool = await getPool(newDbName);
        
        const tablesRes = await sourcePool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
        
        for (const row of tablesRes.rows) {
            const table = row.table_name;
            const columnsData = await getPgTableSchema(sourcePool, table);
            const colDefs = columnsData.map(c => `"${c.column_name}" ${c.data_type}`).join(', ');
            await targetPool.query(`CREATE TABLE "${table}" (${colDefs})`);
            
            for (const col of columnsData) {
                if (col.column_comment) {
                    const safeComment = col.column_comment.replace(/'/g, "''");
                    await targetPool.query(`COMMENT ON COLUMN "${table}"."${col.column_name}" IS '${safeComment}'`);
                }
            }
            
            const dataRes = await sourcePool.query(`SELECT * FROM "${table}"`);
            if (dataRes.rows.length > 0) {
                const columns = columnsData.map(c => `"${c.column_name}"`).join(', ');
                const batchSize = 100;
                for (let i = 0; i < dataRes.rows.length; i += batchSize) {
                    const chunk = dataRes.rows.slice(i, i + batchSize);
                    let params = [];
                    let placeholders = [];
                    let pIdx = 1;
                    chunk.forEach(rowData => {
                        let rowPh = [];
                        columnsData.forEach(col => {
                            rowPh.push(`$${pIdx++}`);
                            params.push(rowData[col.column_name]);
                        });
                        placeholders.push(`(${rowPh.join(',')})`);
                    });
                    await targetPool.query(`INSERT INTO "${table}" (${columns}) VALUES ${placeholders.join(',')}`, params);
                }
            }
        }

        const sysPool = await getPool(SYSTEM_DB);
        await sysPool.query(
            `INSERT INTO "${NOTEBOOK_LIST_TABLE}" (id, db_name, topic, user_id, icon_name, suggestions_json, views, is_db_owner) VALUES ($1, $2, $3, $4, $5, $6, 0, TRUE)`,
            [id, newDbName, topic, 0, iconName, suggestionsJson]
        );
        const newNbRes = await sysPool.query(`SELECT * FROM "${NOTEBOOK_LIST_TABLE}" WHERE id = $1`, [id]);
        return newNbRes.rows[0];
    }
  }

  async updateNotebook(id, topic, suggestionsJson, dbName, isDbOwner) {
    const pool = await getPool(SYSTEM_DB);
    const updates = [];
    const params = [];
    let idx = 1;

    const addUpdate = (col, val) => {
        if (val !== undefined) {
            if (this.type === 'mysql') {
                updates.push(`${col} = ?`);
                params.push(val);
            } else {
                updates.push(`${col} = $${idx++}`);
                params.push(val);
            }
        }
    };

    addUpdate('topic', topic);
    addUpdate('suggestions_json', suggestionsJson);
    addUpdate('db_name', dbName);
    addUpdate('is_db_owner', isDbOwner);

    if (updates.length > 0) {
        if (this.type === 'mysql') {
            const query = `UPDATE \`${NOTEBOOK_LIST_TABLE}\` SET ${updates.join(', ')} WHERE id = ?`;
            params.push(id);
            await pool.query(query, params);
        } else {
            const query = `UPDATE "${NOTEBOOK_LIST_TABLE}" SET ${updates.join(', ')} WHERE id = $${idx}`;
            params.push(id);
            await pool.query(query, params);
        }
    }
  }

  async deleteNotebook(id) {
    const pool = await getPool(SYSTEM_DB);
    if (this.type === 'mysql') {
        const [rows] = await pool.query(`SELECT db_name, is_db_owner FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
        if (rows.length > 0) {
            const { db_name, is_db_owner } = rows[0];
            const isProtected = [SYSTEM_DB, MASTER_DB, 'mysql', 'information_schema', 'performance_schema', 'sys'].includes(db_name);
            
            // Only drop if owner and not a system/protected database and NOT an external connection URI
            const isUri = db_name.includes('://');
            if (is_db_owner && !isProtected && !isUri) {
                const rootConn = await this._getRootConnection();
                await rootConn.query(`DROP DATABASE IF EXISTS \`${db_name}\``);
                await rootConn.end();
            }
        }
        await pool.query(`DELETE FROM \`${PUBLISHED_APPS_TABLE}\` WHERE source_notebook_id = ?`, [id]);
        await pool.query(`DELETE FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
    } else if (this.type === 'postgres') {
        const res = await pool.query(`SELECT db_name, is_db_owner FROM "${NOTEBOOK_LIST_TABLE}" WHERE id = $1`, [id]);
        if (res.rows.length > 0) {
            const { db_name, is_db_owner } = res.rows[0];
            const isProtected = [SYSTEM_DB, MASTER_DB, 'postgres'].includes(db_name);
            const isUri = db_name.includes('://');

            if (is_db_owner && !isProtected && !isUri) {
                const rootConn = await this._getRootConnection();
                await rootConn.query(`
                    SELECT pg_terminate_backend(pg_stat_activity.pid)
                    FROM pg_stat_activity
                    WHERE pg_stat_activity.datname = $1
                    AND pid <> pg_backend_pid()
                `, [db_name]);
                await rootConn.query(`DROP DATABASE IF EXISTS "${db_name}"`);
                await rootConn.end();
            }
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
            ON CONFLICT (user_id) DO UPDATE SET settings_json = EXCLUDED.settings_json, updated_at = CURRENT_TIMESTAMP
        `, [userId, JSON.stringify(settings)]);
    }
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
            const result = await pool.query(sql);
            
            if (Array.isArray(result)) {
                const lastRes = result[result.length - 1];
                return {
                    rows: lastRes.rows,
                    columns: lastRes.fields ? lastRes.fields.map(f => f.name) : []
                };
            }
            
            if (result.command === 'SELECT' || (result.rows && result.rows.length > 0)) {
                return {
                    rows: result.rows,
                    columns: result.fields ? result.fields.map(f => f.name) : []
                };
            } else {
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
