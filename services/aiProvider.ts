
import { TableMetadata, DevMode, Suggestion, AIChartConfig } from "../types";
import * as gemini from "./geminiService";
import * as aliyun from "./aliyunService";

export interface AiService {
  generateCode(prompt: string, mode: DevMode, tables: TableMetadata[]): Promise<string>;
  debugCode(prompt: string, mode: DevMode, tables: TableMetadata[], code: string, error: string): Promise<string>;
  inferColumnMetadata(tableName: string, data: any[]): Promise<Record<string, string>>;
  generateAnalysis(query: string, result: any[]): Promise<string>;
  generateSuggestions(tables: TableMetadata[]): Promise<Suggestion[]>;
  recommendCharts(query: string, result: any[]): Promise<AIChartConfig[]>;
}

const getProvider = (): AiService => {
  const providerKey = (typeof process !== 'undefined' ? process.env.AI_PROVIDER : 'aliyun') || 'aliyun';
  if (providerKey.toLowerCase() === 'gemini') {
    return gemini as AiService;
  }
  return aliyun as AiService;
};

export const generateCode = (prompt: string, mode: DevMode, tables: TableMetadata[]) => 
  getProvider().generateCode(prompt, mode, tables);

export const debugCode = (prompt: string, mode: DevMode, tables: TableMetadata[], code: string, error: string) => 
  getProvider().debugCode(prompt, mode, tables, code, error);

export const inferColumnMetadata = (tableName: string, data: any[]) => 
  getProvider().inferColumnMetadata(tableName, data);

export const generateAnalysis = (query: string, result: any[]) => 
  getProvider().generateAnalysis(query, result);

export const generateSuggestions = (tables: TableMetadata[]) =>
  getProvider().generateSuggestions(tables);

export const recommendCharts = (query: string, result: any[]) =>
  getProvider().recommendCharts(query, result);
