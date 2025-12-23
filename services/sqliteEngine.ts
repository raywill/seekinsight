
import initSqlJs from "sql.js";
import { DatabaseEngine } from "./dbService";
import { ExecutionResult, TableMetadata, Column } from "../types";

export class SQLiteEngine implements DatabaseEngine {
  private db: any = null;
  private tables: TableMetadata[] = [];
  private ready: boolean = false;

  async init() {
    try {
      const globalRef = (typeof window !== 'undefined' ? window : globalThis) as any;
      const originalProcess = globalRef.process;
      const originalModule = globalRef.module;
      const originalRequire = globalRef.require;

      try {
        if (originalProcess) globalRef.process = undefined;
        if (originalModule) globalRef.module = undefined;
        if (originalRequire) globalRef.require = undefined;
      } catch (e) {}

      const SQL = await initSqlJs({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/${file}`
      });

      try {
        if (originalProcess) globalRef.process = originalProcess;
        if (originalModule) globalRef.module = originalModule;
        if (originalRequire) globalRef.require = originalRequire;
      } catch (e) {}
      
      this.db = new SQL.Database();
      this.ready = true;
    } catch (err) {
      throw new Error(`Database Initialization Failed: ${err instanceof Error ? err.message : 'Unknown Error'}`);
    }
  }

  isReady() {
    return this.ready;
  }

  async executeQuery(sql: string): Promise<ExecutionResult> {
    if (!this.db) throw new Error("Database not initialized yet.");
    const res = this.db.exec(sql);
    if (res.length === 0) return { data: [], columns: [], timestamp: new Date().toLocaleTimeString() };
    const columns = res[0].columns;
    const data = res[0].values.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
      return obj;
    });
    return { data, columns, timestamp: new Date().toLocaleTimeString() };
  }

  async refreshTableStats(tableName: string): Promise<number> {
    const res = await this.executeQuery(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
    const count = parseInt(res.data[0].cnt || 0);
    const table = this.tables.find(t => t.tableName === tableName);
    if (table) table.rowCount = count;
    return count;
  }

  async createTableFromData(name: string, data: any[], aiComments?: Record<string, string>): Promise<TableMetadata> {
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const columns: Column[] = Object.keys(data[0]).map(key => ({
      name: key,
      type: typeof data[0][key] === 'number' ? 'REAL' : 'TEXT',
      comment: aiComments?.[key] || `Imported: ${key}`
    }));

    const ddlCols = columns.map(c => `"${c.name}" ${c.type}`).join(", ");
    this.db.run(`DROP TABLE IF EXISTS "${sanitizedName}"`);
    this.db.run(`CREATE TABLE "${sanitizedName}" (${ddlCols})`);

    const placeholders = Object.keys(data[0]).map(() => "?").join(",");
    const insertStmt = this.db.prepare(`INSERT INTO "${sanitizedName}" VALUES (${placeholders})`);
    this.db.run("BEGIN TRANSACTION");
    data.forEach(row => insertStmt.run(Object.values(row)));
    this.db.run("COMMIT");
    insertStmt.free();

    const newTable: TableMetadata = {
      id: Math.random().toString(36).substr(2, 9),
      tableName: sanitizedName,
      columns,
      rowCount: data.length
    };
    this.tables.push(newTable);
    return newTable;
  }

  async getTables(): Promise<TableMetadata[]> {
    return this.tables;
  }
}
