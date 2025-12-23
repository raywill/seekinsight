
import { TableMetadata, DevMode } from "../types";
import * as gemini from "./geminiService";
import * as aliyun from "./aliyunService";

export interface AiService {
  generateCode(prompt: string, mode: DevMode, tables: TableMetadata[]): Promise<string>;
  inferColumnMetadata(tableName: string, data: any[]): Promise<Record<string, string>>;
  generateAnalysis(query: string, result: any[]): Promise<string>;
}

const PROVIDERS: Record<string, AiService> = {
  gemini: gemini as AiService,
  aliyun: aliyun as AiService
};

// Default to Aliyun as requested, configurable via AI_PROVIDER environment variable
const activeProviderKey = (process.env.AI_PROVIDER || 'aliyun').toLowerCase();
const provider = PROVIDERS[activeProviderKey] || aliyun;

export const generateCode = provider.generateCode;
export const inferColumnMetadata = provider.inferColumnMetadata;
export const generateAnalysis = provider.generateAnalysis;
