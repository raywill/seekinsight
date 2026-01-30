
import mysql from 'mysql2/promise';
import pg from 'pg';
import { URL } from 'url';
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
            connectionTimeoutMillis: 10000, // Increased to 10s for cloud/serverless DBs
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
    connectionTimeoutMillis: 10000, // Increased to 10s
  };
}

export async function getPool(dbName) {
  if (pools.has(dbName)) {
    return pools.get(dbName);
  }

  // Detect if dbName is a connection string
  let isUri = dbName.includes('://');
  let type = DB_TYPE;
  let uriConfig = {};

  if (isUri) {
      try {
          const parsed = new URL(dbName);
          const protocol = parsed.protocol.replace(':', '');
          if (protocol.startsWith('mysql')) type = 'mysql';
          if (protocol.startsWith('postgres') || protocol.startsWith('postgresql')) type = 'postgres';
          
          uriConfig = {
              host: parsed.hostname,
              port: parsed.port ? parseInt(parsed.port) : undefined,
              user: parsed.username,
              password: parsed.password,
              database: parsed.pathname.replace('/', '')
          };
      } catch (e) {
          console.error("Invalid Connection URI", e);
          throw new Error("Invalid Connection String");
      }
  }

  if (type === 'mysql') {
    let poolConfig;
    if (isUri) {
        poolConfig = {
            ...uriConfig,
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
    } else {
        poolConfig = getMysqlPoolConfig(dbName);
    }
    
    const pool = mysql.createPool(poolConfig);
    pools.set(dbName, pool);
    return pool;
  } else if (type === 'postgres') {
    let poolConfig;
    if (isUri) {
        // PG client supports connection string directly
        poolConfig = {
            connectionString: dbName,
            ssl: { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000
        };
    } else {
        poolConfig = getPgPoolConfig(dbName);
    }
    
    const pool = new pg.Pool(poolConfig);
    pools.set(dbName, pool);
    return pool;
  }
}

// Init system via DAL
export async function initSystem() {
    await dal.initSystem();
}
