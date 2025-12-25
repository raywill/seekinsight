
import { ExecutionResult, TableMetadata } from "../types";

export interface DatabaseEngine {
  init(): Promise<void>;
  executeQuery(sql: string): Promise<ExecutionResult>;
  createTableFromData(name: string, data: any[], aiComments?: Record<string, string>): Promise<TableMetadata>;
  getTables(): Promise<TableMetadata[]>;
  refreshTableStats(tableName: string): Promise<number>;
  isReady(): boolean;
  // New methods for persistent config
  getConfig(key: string): Promise<string | null>;
  setConfig(key: string, value: string): Promise<void>;
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
