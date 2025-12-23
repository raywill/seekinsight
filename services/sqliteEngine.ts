
import initSqlJs from "sql.js";
import { DatabaseEngine } from "./dbService";
import { ExecutionResult, TableMetadata, Column } from "../types";

export class SQLiteEngine implements DatabaseEngine {
  private db: any = null;
  private tables: TableMetadata[] = [];
  private ready: boolean = false;

  async init() {
    try {
      console.log("Initiating hard-isolation for SQLite Engine...");
      
      const globalRef = (typeof window !== 'undefined' ? window : globalThis) as any;
      
      // Emscripten (which powers sql.js) detects Node.js by checking 'process', 'module', and 'require'.
      // In sandboxed browser environments (like StackBlitz/WebContainers), these are often polyfilled 
      // but incomplete, causing 'fs.readFileSync is not implemented' errors.
      
      const originalProcess = globalRef.process;
      const originalModule = globalRef.module;
      const originalRequire = globalRef.require;

      // Temporarily delete/hide them to force ENVIRONMENT_IS_WEB = true in Emscripten logic
      try {
        if (originalProcess) globalRef.process = undefined;
        if (originalModule) globalRef.module = undefined;
        if (originalRequire) globalRef.require = undefined;
      } catch (e) {
        console.warn("Could not mask environment globals:", e);
      }

      const SQL = await initSqlJs({
        // Use a direct CDN for the WASM binary to ensure it's fetched via network
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/${file}`
      });

      // Restore environment globals
      try {
        if (originalProcess) globalRef.process = originalProcess;
        if (originalModule) globalRef.module = originalModule;
        if (originalRequire) globalRef.require = originalRequire;
      } catch (e) {
        // Fallback: if we can't restore, the app still works as it's a browser app
      }
      
      this.db = new SQL.Database();
      this.ready = true;
      console.log("SQLite Engine Initialized Successfully in Browser Mode");
    } catch (err) {
      console.error("FATAL: Failed to initialize SQLite Engine:", err);
      throw new Error(`Database Initialization Failed: ${err instanceof Error ? err.message : 'Unknown Error'}`);
    }
  }

  isReady() {
    return this.ready;
  }

  async executeQuery(sql: string): Promise<ExecutionResult> {
    if (!this.db) throw new Error("Database not initialized yet.");
    
    try {
      const res = this.db.exec(sql);
      
      if (res.length === 0) {
        return {
          data: [],
          columns: [],
          timestamp: new Date().toLocaleTimeString()
        };
      }

      const columns = res[0].columns;
      const data = res[0].values.map((row: any[]) => {
        const obj: any = {};
        columns.forEach((col: string, i: number) => {
          obj[col] = row[i];
        });
        return obj;
      });

      return {
        data,
        columns,
        timestamp: new Date().toLocaleTimeString()
      };
    } catch (e: any) {
      console.error("SQL Execution Error:", e);
      throw new Error(`SQL Error: ${e.message}`);
    }
  }

  async createTableFromData(name: string, data: any[], aiComments?: Record<string, string>): Promise<TableMetadata> {
    if (!data || data.length === 0) throw new Error("Cannot create table: Data is empty.");
    
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    const columns: Column[] = Object.keys(data[0]).map(key => ({
      name: key,
      type: this.inferType(data[0][key]),
      comment: aiComments?.[key] || `Imported from file: ${key}`
    }));

    const ddlCols = columns.map(c => `"${c.name}" ${c.type}`).join(", ");
    this.db.run(`DROP TABLE IF EXISTS "${sanitizedName}"`);
    this.db.run(`CREATE TABLE "${sanitizedName}" (${ddlCols})`);

    const placeholders = Object.keys(data[0]).map(() => "?").join(",");
    const insertStmt = this.db.prepare(`INSERT INTO "${sanitizedName}" VALUES (${placeholders})`);
    
    try {
      this.db.run("BEGIN TRANSACTION");
      data.forEach(row => {
        insertStmt.run(Object.values(row));
      });
      this.db.run("COMMIT");
    } catch (err) {
      this.db.run("ROLLBACK");
      throw err;
    } finally {
      insertStmt.free();
    }

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

  private inferType(val: any): string {
    if (val === null || val === undefined) return 'TEXT';
    if (typeof val === 'number') return Number.isInteger(val) ? 'INTEGER' : 'REAL';
    if (typeof val === 'boolean') return 'INTEGER';
    return 'TEXT';
  }
}
