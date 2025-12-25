
import { TableMetadata, DevMode, Suggestion, AIChartConfig } from "../types";
import * as gemini from "./geminiService";
import * as aliyun from "./aliyunService";

export interface AiService {
  generateCode(prompt: string, mode: DevMode, tables: TableMetadata[]): Promise<string>;
  debugCode(prompt: string, mode: DevMode, tables: TableMetadata[], code: string, error: string): Promise<string>;
  inferColumnMetadata(tableName: string, data: any[]): Promise<Record<string, string>>;
  generateAnalysis(query: string, result: any[], topic: string, prompt?: string): Promise<string>;
  generateSuggestions(tables: TableMetadata[], topic: string): Promise<Suggestion[]>;
  recommendCharts(query: string, result: any[]): Promise<AIChartConfig[]>;
  generateTopic(currentTopic: string, tables: TableMetadata[]): Promise<string>;
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

export const generateAnalysis = (query: string, result: any[], topic: string, prompt?: string) => 
  getProvider().generateAnalysis(query, result, topic, prompt);

export const generateSuggestions = (tables: TableMetadata[], topic: string) =>
  getProvider().generateSuggestions(tables, topic);

export const recommendCharts = (query: string, result: any[]) =>
  getProvider().recommendCharts(query, result);

export const generateTopic = (currentTopic: string, tables: TableMetadata[]) =>
  getProvider().generateTopic(currentTopic, tables);
