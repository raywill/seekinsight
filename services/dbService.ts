
import { ExecutionResult, TableMetadata } from "../types";

export interface DatabaseEngine {
  init(): Promise<void>;
  executeQuery(sql: string): Promise<ExecutionResult>;
  createTableFromData(name: string, data: any[], aiComments?: Record<string, string>): Promise<TableMetadata>;
  getTables(): Promise<TableMetadata[]>;
  refreshTableStats(tableName: string): Promise<number>; // 新增：刷新单表行数
  isReady(): boolean;
}

/**
 * Global database service instance.
 */
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
