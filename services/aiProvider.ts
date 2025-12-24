
import { TableMetadata, DevMode, Suggestion } from "../types";
import * as gemini from "./geminiService";
import * as aliyun from "./aliyunService";

export interface AiService {
  generateCode(prompt: string, mode: DevMode, tables: TableMetadata[]): Promise<string>;
  inferColumnMetadata(tableName: string, data: any[]): Promise<Record<string, string>>;
  generateAnalysis(query: string, result: any[]): Promise<string>;
  generateSuggestions(tables: TableMetadata[]): Promise<Suggestion[]>;
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

export const inferColumnMetadata = (tableName: string, data: any[]) => 
  getProvider().inferColumnMetadata(tableName, data);

export const generateAnalysis = (query: string, result: any[]) => 
  getProvider().generateAnalysis(query, result);

export const generateSuggestions = (tables: TableMetadata[]) =>
  getProvider().generateSuggestions(tables);
