
import { TableMetadata, DevMode, Suggestion, AIChartConfig } from "../types";
import { SYSTEM_PROMPTS, USER_PROMPTS } from "./prompts";

async function callAliyun(messages: { role: string; content: string }[], temperature = 0.7, jsonMode = false) {
  const API_KEY = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
  const BASE_URL = (typeof process !== 'undefined' ? process.env.API_BASEURL : undefined) || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  if (!API_KEY) {
    throw new Error("Aliyun API Key is missing.");
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages,
      temperature,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {})
    })
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || `Aliyun API Error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export const generateCode = async (prompt: string, mode: DevMode, tables: TableMetadata[]): Promise<string> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}\nColumns:\n${t.columns.map(c => `- ${c.name} (${c.type}): ${c.comment}`).join('\n')}`
  ).join('\n\n');

  const messages = [
    { role: "system", content: SYSTEM_PROMPTS.CODE_GEN(mode, schemaStr) },
    { role: "user", content: prompt }
  ];

  const responseText = await callAliyun(messages, 0.1);
  return responseText.replace(/```(sql|python)?/g, '').replace(/```/g, '').trim();
};

export const inferColumnMetadata = async (tableName: string, data: any[]): Promise<Record<string, string>> => {
  if (!data || data.length === 0) return {};
  const sample = data.slice(0, 5);
  const headers = Object.keys(data[0]);

  const messages = [
    { role: "system", content: SYSTEM_PROMPTS.METADATA_INFER },
    { role: "user", content: USER_PROMPTS.METADATA_INFER(tableName, headers, sample) }
  ];

  try {
    const responseText = await callAliyun(messages, 0.3, true);
    return JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (err) {
    return {};
  }
};

export const generateAnalysis = async (query: string, result: any[]): Promise<string> => {
  if (!result || result.length === 0) return "No data returned to analyze.";
  const messages = [
    { role: "system", content: SYSTEM_PROMPTS.ANALYSIS },
    { role: "user", content: `Query: ${query}\nSample: ${JSON.stringify(result.slice(0, 5))}` }
  ];
  return await callAliyun(messages, 0.5);
};

export const recommendCharts = async (query: string, result: any[]): Promise<AIChartConfig[]> => {
  if (!result || result.length === 0) return [];
  const columns = Object.keys(result[0]);
  const sample = result.slice(0, 10);

  const messages = [
    { role: "system", content: SYSTEM_PROMPTS.CHART_REC },
    { role: "user", content: USER_PROMPTS.CHART_REC(query, columns, sample) }
  ];

  try {
    const responseText = await callAliyun(messages, 0.2, true);
    const data = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
    return data.charts || [];
  } catch (err) {
    console.error("Chart recommendation failed", err);
    return [];
  }
};

export const generateSuggestions = async (tables: TableMetadata[]): Promise<Suggestion[]> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}\nColumns: ${t.columns.map(c => `${c.name} (${c.type})`).join(', ')}`
  ).join('\n\n');

  const messages = [
    { role: "system", content: "You are a strategic consultant. Respond with JSON object { 'suggestions': [...] }" },
    { role: "user", content: `Generate 8 ideas based on:\n${schemaStr}` }
  ];

  try {
    const responseText = await callAliyun(messages, 0.7, true);
    const data = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
    return (data.suggestions || []).map((s: any) => ({
      ...s,
      id: s.id || Math.random().toString(36).substr(2, 9),
      type: s.type === 'SQL' ? DevMode.SQL : DevMode.PYTHON
    }));
  } catch (err) {
    return [];
  }
};
