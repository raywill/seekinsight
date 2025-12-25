
import { ExecutionResult, TableMetadata } from "../types";

export interface DatabaseEngine {
  init(): Promise<void>;
  executeQuery(sql: string, dbName: string): Promise<ExecutionResult>;
  createTableFromData(name: string, data: any[], dbName: string, aiComments?: Record<string, string>, onProgress?: (percent: number) => void): Promise<TableMetadata>;
  getTables(dbName: string): Promise<TableMetadata[]>;
  refreshTableStats(tableName: string, dbName: string): Promise<number>;
  isReady(): boolean;
}

let instance: DatabaseEngine | null = null;

export const setDatabaseEngine = (engine: DatabaseEngine) => {
  instance = engine;
};

export const getDatabaseEngine = (): DatabaseEngine => {
  if (!instance) {
    throw new Error("Database engine not initialized");
  }
  return instance;
};
