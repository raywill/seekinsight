
import { TableMetadata, DevMode, Suggestion, AIChartConfig } from "../types";
import { SYSTEM_PROMPTS, USER_PROMPTS } from "./prompts";

const IS_DEBUG = process.env.SI_DEBUG_MODE !== 'false';
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';

async function logPrompt(type: string, content: string) {
  if (!IS_DEBUG) return;
  try {
    await fetch(`${GATEWAY_URL}/log-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content })
    });
  } catch (err) {
    console.warn("Failed to send prompt log to gateway", err);
  }
}

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

export const generateTopic = async (currentTopic: string, tables: TableMetadata[]): Promise<string> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}\nColumns: ${t.columns.map(c => `${c.name} (${c.type})`).join(', ')}`
  ).join('\n\n');

  const userContent = USER_PROMPTS.TOPIC_GEN(currentTopic, schemaStr);
  const messages = [
    { role: "system", content: SYSTEM_PROMPTS.TOPIC_GEN },
    { role: "user", content: userContent }
  ];

  await logPrompt('TOPIC_GEN', `System: ${SYSTEM_PROMPTS.TOPIC_GEN}\nUser: ${userContent}`);

  const responseText = await callAliyun(messages, 0.3);
  return responseText.replace(/['"“”]/g, '').trim().substring(0, 10);
};

export const generateCode = async (prompt: string, mode: DevMode, tables: TableMetadata[]): Promise<string> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}\nColumns:\n${t.columns.map(c => `- ${c.name} (${c.type}): ${c.comment}`).join('\n')}`
  ).join('\n\n');

  const systemInstruction = SYSTEM_PROMPTS.CODE_GEN(mode, schemaStr);
  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: prompt }
  ];

  await logPrompt(`CODE_GEN_${mode}`, `System: ${systemInstruction}\nUser: ${prompt}`);

  const responseText = await callAliyun(messages, 0.1);
  return responseText.replace(/```(sql|python)?/g, '').replace(/```/g, '').trim();
};

export const debugCode = async (prompt: string, mode: DevMode, tables: TableMetadata[], code: string, error: string): Promise<string> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}\nColumns:\n${t.columns.map(c => `- ${c.name} (${c.type}): ${c.comment}`).join('\n')}`
  ).join('\n\n');

  const systemInstruction = SYSTEM_PROMPTS.DEBUG_CODE(mode, schemaStr);
  const userContent = `Original Prompt: ${prompt}\n\nFaulty Code:\n${code}\n\nExecution Error:\n${error}`;
  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: userContent }
  ];

  await logPrompt(`DEBUG_CODE_${mode}`, `System: ${systemInstruction}\nUser: ${userContent}`);

  const responseText = await callAliyun(messages, 0.1);
  return responseText.replace(/```(sql|python)?/g, '').replace(/```/g, '').trim();
};

export const inferColumnMetadata = async (tableName: string, data: any[]): Promise<Record<string, string>> => {
  if (!data || data.length === 0) return {};
  const sample = data.slice(0, 5);
  const headers = Object.keys(data[0]);

  const userContent = USER_PROMPTS.METADATA_INFER(tableName, headers, sample);
  const messages = [
    { role: "system", content: SYSTEM_PROMPTS.METADATA_INFER },
    { role: "user", content: userContent }
  ];

  await logPrompt('METADATA_INFER', `System: ${SYSTEM_PROMPTS.METADATA_INFER}\nUser: ${userContent}`);

  try {
    const responseText = await callAliyun(messages, 0.3, true);
    return JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (err) {
    return {};
  }
};

export const generateAnalysis = async (query: string, result: any[], topic: string, prompt?: string): Promise<string> => {
  if (!result || result.length === 0) return "No data returned to analyze.";
  
  const userContent = `
${prompt ? `Business Requirement: ${prompt}` : ''}
Executed SQL: ${query}
Result Data (Sample): ${JSON.stringify(result.slice(0, 5))}
  `.trim();
  
  const systemInstruction = SYSTEM_PROMPTS.ANALYSIS(topic);
  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: userContent }
  ];
  
  await logPrompt('ANALYSIS', `System: ${systemInstruction}\nUser: ${userContent}`);
  
  return await callAliyun(messages, 0.5);
};

export const recommendCharts = async (query: string, result: any[]): Promise<AIChartConfig[]> => {
  if (!result || result.length === 0) return [];
  const columns = Object.keys(result[0]);
  const sample = result.slice(0, 10);

  const userContent = USER_PROMPTS.CHART_REC(query, columns, sample);
  const messages = [
    { role: "system", content: SYSTEM_PROMPTS.CHART_REC },
    { role: "user", content: userContent }
  ];

  await logPrompt('CHART_REC', `System: ${SYSTEM_PROMPTS.CHART_REC}\nUser: ${userContent}`);

  try {
    const responseText = await callAliyun(messages, 0.2, true);
    const data = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
    return data.charts || [];
  } catch (err) {
    console.error("Chart recommendation failed", err);
    return [];
  }
};

export const generateSuggestions = async (tables: TableMetadata[], topic: string): Promise<Suggestion[]> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}\nColumns: ${t.columns.map(c => `${c.name} (${c.type})`).join(', ')}`
  ).join('\n\n');

  const userContent = `Database Schema:\n${schemaStr}`;
  const systemInstruction = SYSTEM_PROMPTS.SUGGESTIONS(topic);
  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: userContent }
  ];

  await logPrompt('SUGGESTIONS', `System: ${systemInstruction}\nUser: ${userContent}`);

  try {
    const responseText = await callAliyun(messages, 0.7, true);
    const data = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
    return (data.suggestions || []).map((s: any) => ({
      id: s.id || `ai_${Math.random().toString(36).substr(2, 9)}`,
      title: s.title || "New Insight",
      prompt: s.prompt || "Analyze the dataset for trends.",
      category: s.category || "General",
      type: s.type?.toUpperCase() === 'SQL' ? DevMode.SQL : DevMode.PYTHON
    }));
  } catch (err) {
    console.error("Aliyun suggestion generation failed", err);
    return [];
  }
};
