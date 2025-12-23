
import { DatabaseEngine } from "./dbService";
import { ExecutionResult, TableMetadata, Column } from "../types";

/**
 * MySQLEngine provides real access to MySQL/OceanBase via a Node.js gateway.
 */
export class MySQLEngine implements DatabaseEngine {
  private tables: TableMetadata[] = [];
  private ready: boolean = false;
  private sessionId: string | null = null;
  
  private config = {
    dbHost: process.env.MYSQL_IP,
    dbPort: process.env.MYSQL_PORT,
    dbUser: process.env.MYSQL_USER,
    dbName: process.env.MYSQL_DB,
    dbPassword: (process.env as any).MYSQL_PASSWORD || ''
  };

  private gatewayUrl = `http://localhost:3001`;

  async init() {
    if (!this.config.dbHost || !this.config.dbPort) {
      throw new Error("Missing MYSQL_IP or MYSQL_PORT environment variables.");
    }

    try {
      const response = await fetch(`${this.gatewayUrl}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: this.config.dbHost,
          port: this.config.dbPort,
          user: this.config.dbUser,
          password: this.config.dbPassword,
          database: this.config.dbName
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to connect to gateway.");

      this.sessionId = result.sessionId;
      this.ready = true;
      
      // Auto-load existing tables upon initialization
      await this.loadExistingTables();
    } catch (err: any) {
      this.ready = false;
      throw new Error(`Database backend connection failed: ${err.message}`);
    }
  }

  /**
   * Optimized: Scans the database for existing tables and populates the metadata using information_schema.
   * This prevents multiple per-table calls that lead to "maximum open cursors exceeded".
   */
  private async loadExistingTables() {
    try {
      // 1. 获取所有表及其行数 (TABLE_ROWS 是估算值，但在 MVP 中足够)
      const tablesInfoRes = await this.executeQuery(`
        SELECT TABLE_NAME, TABLE_ROWS 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = '${this.config.dbName}'
      `);
      
      if (tablesInfoRes.data.length === 0) return;

      // 2. 批量获取所有表的列信息
      const columnsInfoRes = await this.executeQuery(`
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = '${this.config.dbName}'
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

      const loadedTables: TableMetadata[] = tablesInfoRes.data.map(row => ({
        id: Math.random().toString(36).substr(2, 9),
        tableName: row.TABLE_NAME,
        columns: columnsByTable[row.TABLE_NAME] || [],
        rowCount: row.TABLE_ROWS || 0
      }));

      this.tables = loadedTables;
    } catch (err) {
      console.warn("Failed to load existing tables efficiently:", err);
      // Fallback to basic list if bulk load fails
      try {
        const res = await this.executeQuery(`SHOW TABLES`);
        const tableNames = res.data.map(row => Object.values(row)[0] as string);
        this.tables = tableNames.map(name => ({
          id: Math.random().toString(36).substr(2, 9),
          tableName: name,
          columns: [],
          rowCount: 0
        }));
      } catch (e) {}
    }
  }

  isReady() {
    return this.ready;
  }

  async executeQuery(sql: string): Promise<ExecutionResult> {
    if (!this.ready) throw new Error("Database not connected");
    
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
