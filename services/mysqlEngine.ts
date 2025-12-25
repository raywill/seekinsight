
import { DatabaseEngine } from "./dbService";
import { ExecutionResult, TableMetadata, Column } from "../types";

export class MySQLEngine implements DatabaseEngine {
  private tables: TableMetadata[] = [];
  private ready: boolean = false;
  private sessionId: string | null = null;
  private configTableName = '__seekinsight_config';
  
  private gatewayUrl = (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';

  private getConfigParams() {
    return {
      dbHost: typeof process !== 'undefined' ? process.env.MYSQL_IP : undefined,
      dbPort: typeof process !== 'undefined' ? process.env.MYSQL_PORT : undefined,
      dbUser: typeof process !== 'undefined' ? process.env.MYSQL_USER : undefined,
      dbName: typeof process !== 'undefined' ? process.env.MYSQL_DB : undefined,
      dbPassword: typeof process !== 'undefined' ? (process.env as any).MYSQL_PASSWORD : ''
    };
  }

  async init() {
    if (this.ready && this.sessionId) return;

    const config = this.getConfigParams();
    if (!config.dbHost || !config.dbPort) {
      throw new Error("Missing MYSQL_IP or MYSQL_PORT environment variables.");
    }

    try {
      const response = await fetch(`${this.gatewayUrl}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: config.dbHost,
          port: config.dbPort,
          user: config.dbUser,
          password: config.dbPassword,
          database: config.dbName
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to connect to gateway.");

      this.sessionId = result.sessionId;
      this.ready = true;
      
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS \`${this.configTableName}\` (
          cfg_key VARCHAR(50) PRIMARY KEY,
          cfg_value TEXT
        ) COMMENT 'Internal system configuration'
      `);

      await this.loadExistingTables();
    } catch (err: any) {
      this.ready = false;
      this.sessionId = null;
      throw new Error(`Database backend connection failed: ${err.message}.`);
    }
  }

  async getConfig(key: string): Promise<string | null> {
    try {
      const res = await this.executeQuery(`SELECT cfg_value FROM \`${this.configTableName}\` WHERE cfg_key = '${key}'`);
      return res.data[0]?.cfg_value || null;
    } catch (e) {
      return null;
    }
  }

  async setConfig(key: string, value: string): Promise<void> {
    const sanitizedVal = value.replace(/'/g, "''");
    await this.executeQuery(`REPLACE INTO \`${this.configTableName}\` (cfg_key, cfg_value) VALUES ('${key}', '${sanitizedVal}')`);
  }

  private async loadExistingTables() {
    const config = this.getConfigParams();
    try {
      // Corrected: Use escaped underscores \_\_ to match literal underscores and avoid filtering business tables.
      // In JS strings, we need double backslash \\ to produce a single backslash in the SQL query.
      const tablesInfoRes = await this.executeQuery(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = '${config.dbName}' 
        AND TABLE_NAME NOT LIKE '\\_\\_%'
      `);
      
      if (tablesInfoRes.data.length === 0) {
        this.tables = [];
        return;
      }

      const columnsInfoRes = await this.executeQuery(`
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = '${config.dbName}'
        AND TABLE_NAME NOT LIKE '\\_\\_%'
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `);

      const columnsByTable: Record<string, Column[]> = {};
      columnsInfoRes.data.forEach(row => {
        if (!columnsByTable[row.TABLE_NAME]) {
          columnsByTable[row.TABLE_NAME] = [];
        }
        columnsByTable[row.TABLE_NAME].push({
          name: row.COLUMN_NAME,
          type: row.DATA_TYPE.toUpperCase(),
          comment: row.COLUMN_COMMENT || ''
        });
      });

      this.tables = tablesInfoRes.data.map(row => ({
        id: Math.random().toString(36).substr(2, 9),
        tableName: row.TABLE_NAME,
        columns: columnsByTable[row.TABLE_NAME] || [],
        rowCount: -1 
      }));

    } catch (err) {
      console.warn("Failed to load tables:", err);
      this.tables = [];
    }
  }

  isReady() {
    return this.ready;
  }

  async executeQuery(sql: string): Promise<ExecutionResult> {
    if (!this.ready || !this.sessionId) throw new Error("Database not connected");
    
    const response = await fetch(`${this.gatewayUrl}/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "SQL Execution Error");

    return {
      data: result.rows || [],
      columns: result.columns || [],
      timestamp: new Date().toLocaleTimeString()
    };
  }

  async refreshTableStats(tableName: string): Promise<number> {
    const res = await this.executeQuery(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
    const count = parseInt(res.data[0].cnt || 0);
    const table = this.tables.find(t => t.tableName === tableName);
    if (table) table.rowCount = count;
    return count;
  }

  async createTableFromData(name: string, data: any[], aiComments?: Record<string, string>): Promise<TableMetadata> {
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    if (!data || data.length === 0) throw new Error("Data is empty");

    const columns: Column[] = Object.keys(data[0]).map(key => ({
      name: key,
      type: typeof data[0][key] === 'number' ? 'DECIMAL(20,2)' : 'VARCHAR(255)',
      comment: aiComments?.[key] || `Imported: ${key}`
    }));

    const ddlCols = columns.map(c => `\`${c.name}\` ${c.type} COMMENT '${c.comment.replace(/'/g, "''")}'`).join(", ");
    await this.executeQuery(`DROP TABLE IF EXISTS \`${sanitizedName}\``);
    await this.executeQuery(`CREATE TABLE \`${sanitizedName}\` (${ddlCols})`);

    const keys = Object.keys(data[0]);
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const chunk = data.slice(i, i + batchSize);
      const valuesList = chunk.map(row => 
        `(${keys.map(k => {
          const val = row[k];
          if (val === null || val === undefined) return 'NULL';
          return typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : val;
        }).join(',')})`
      ).join(',');
      await this.executeQuery(`INSERT INTO \`${sanitizedName}\` (\`${keys.join('`,`')}\`) VALUES ${valuesList}`);
    }

    const newTable: TableMetadata = {
      id: Math.random().toString(36).substr(2, 9),
      tableName: sanitizedName,
      columns,
      rowCount: data.length
    };

    this.tables = [...this.tables.filter(t => t.tableName !== sanitizedName), newTable];
    return newTable;
  }

  async getTables(): Promise<TableMetadata[]> {
    return this.tables;
  }
}
