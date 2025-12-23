
import { DatabaseEngine } from "./dbService";
import { ExecutionResult, TableMetadata, Column } from "../types";

export class MySQLEngine implements DatabaseEngine {
  private tables: TableMetadata[] = [];
  private ready: boolean = false;
  private sessionId: string | null = null;
  
  private gatewayUrl = `http://localhost:3001`;

  private getConfig() {
    return {
      dbHost: typeof process !== 'undefined' ? process.env.MYSQL_IP : undefined,
      dbPort: typeof process !== 'undefined' ? process.env.MYSQL_PORT : undefined,
      dbUser: typeof process !== 'undefined' ? process.env.MYSQL_USER : undefined,
      dbName: typeof process !== 'undefined' ? process.env.MYSQL_DB : undefined,
      dbPassword: typeof process !== 'undefined' ? (process.env as any).MYSQL_PASSWORD : ''
    };
  }

  async init() {
    const config = this.getConfig();
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
      
      await this.loadExistingTables();
    } catch (err: any) {
      this.ready = false;
      throw new Error(`Database backend connection failed: ${err.message}`);
    }
  }

  private async loadExistingTables() {
    const config = this.getConfig();
    try {
      const tablesInfoRes = await this.executeQuery(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = '${config.dbName}'
      `);
      
      if (tablesInfoRes.data.length === 0) return;

      const columnsInfoRes = await this.executeQuery(`
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = '${config.dbName}'
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
        // 核心修改：统一初始化为 -1，显示为刷新图标而非 0
        rowCount: -1 
      }));

      this.tables = loadedTables;
    } catch (err) {
      console.warn("Failed to load existing tables efficiently:", err);
      try {
        const res = await this.executeQuery(`SHOW TABLES`);
        const tableNames = res.data.map(row => Object.values(row)[0] as string);
        this.tables = tableNames.map(name => ({
          id: Math.random().toString(36).substr(2, 9),
          tableName: name,
          columns: [],
          rowCount: -1 
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
