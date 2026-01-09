
import mysql from 'mysql2/promise';
import pg from 'pg';
import { dal } from './dal.js';
import { DB_TYPE, MYSQL_CONFIG, PG_CONFIG, PG_URL } from './common.js';

export const pools = new Map(); // Stores both MySQL pools and Postgres Clients/Pools

export function getMysqlPoolConfig(db = '') {
  return {
    ...MYSQL_CONFIG,
    database: db,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    multipleStatements: true, 
    typeCast: function (field, next) {
      if (field.type === 'DATETIME' || field.type === 'DATE' || field.type === 'TIMESTAMP') {
        return field.string();
      }
      return next();
    }
  };
}

export function getPgPoolConfig(db = '') {
  if (PG_URL) {
    try {
        const url = new URL(PG_URL);
        if (db) {
            url.pathname = `/${db}`;
        }
        return {
            connectionString: url.toString(),
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            ssl: { rejectUnauthorized: false } // Required for most cloud providers when using connection strings
        };
    } catch (e) {
        console.error("Invalid PG_URL provided, falling back to PG_CONFIG", e);
    }
  }

  return {
    ...PG_CONFIG,
    database: db || 'postgres', // Postgres connects to 'postgres' db by default if none specified, but usually we need a specific one
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

export async function getPool(dbName) {
  if (pools.has(dbName)) {
    return pools.get(dbName);
  }

  if (DB_TYPE === 'mysql') {
    const pool = mysql.createPool(getMysqlPoolConfig(dbName));
    pools.set(dbName, pool);
    return pool;
  } else if (DB_TYPE === 'postgres') {
    const pool = new pg.Pool(getPgPoolConfig(dbName));
    
    // Add simple query wrapper to match interface of mysql2 used in DAL (executeUserQuery)
    // mysql2: [rows, fields] = await pool.query(sql)
    // pg: result = await pool.query(sql); rows = result.rows
    
    // We will handle the API difference in the DAL, but we store the raw pg pool here.
    pools.set(dbName, pool);
    return pool;
  }
}

// Init system via DAL
export async function initSystem() {
    await dal.initSystem();
}
