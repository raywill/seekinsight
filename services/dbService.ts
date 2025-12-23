
import { ExecutionResult, TableMetadata } from "../types";

export interface DatabaseEngine {
  init(): Promise<void>;
  executeQuery(sql: string): Promise<ExecutionResult>;
  // Fix: add optional aiComments parameter to match engine implementations and support AI-driven metadata enrichment
  createTableFromData(name: string, data: any[], aiComments?: Record<string, string>): Promise<TableMetadata>;
  getTables(): Promise<TableMetadata[]>;
  isReady(): boolean;
}

/**
 * Global database service instance.
 * Allows components to interact with data without knowing the underlying engine (SQLite, Mock, etc.)
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
