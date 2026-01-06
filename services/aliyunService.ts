
import { TableMetadata, DevMode, Suggestion, AIChartConfig, ExecutionResult } from "../types";
import { SYSTEM_PROMPTS, USER_PROMPTS } from "./prompts";

const IS_DEBUG = process.env.SI_DEBUG_MODE !== 'false';
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';

// Helper to truncate large strings in samples
const sanitizeSample = (data: any[], maxRows = 5, maxCharsPerField = 200): any[] => {
  return data.slice(0, maxRows).map(row => {
    if (Array.isArray(row)) {
      return row.map(cell => 
        (typeof cell === 'string' && cell.length > maxCharsPerField) 
          ? cell.substring(0, maxCharsPerField) + '...(truncated)' 
          : cell
      );
    } else if (typeof row === 'object' && row !== null) {
      const safeRow: any = {};
      for (const [key, val] of Object.entries(row)) {
        if (typeof val === 'string' && val.length > maxCharsPerField) {
          safeRow[key] = val.substring(0, maxCharsPerField) + '...(truncated)';
        } else {
          safeRow[key] = val;
        }
      }
      return safeRow;
    }
    return row;
  });
};

// New Helper to parse CoT Response
const parseCoTResponse = (text: string): { code: string; thought: string } => {
  if (!text) return { code: "", thought: "" };

  let thought = "";
  let code = text;

  // Extract Thought
  const thoughtMatch = text.match(/<thought>([\s\S]*?)<\/thought>/);
  if (thoughtMatch) {
    thought = thoughtMatch[1].trim();
  }

  // Extract Code
  const codeTagMatch = text.match(/<code>([\s\S]*?)<\/code>/);
  if (codeTagMatch) {
    code = codeTagMatch[1].trim();
  } else {
    // Fallback cleanup if no tags found (legacy behavior)
    code = text
      .replace(/<thought>[\s\S]*?<\/thought>/, '') // Remove thought block if it exists but code block is missing
      .replace(/```(sql|python)?/g, '')
      .replace(/```/g, '')
      .trim();
  }

  return { code, thought };
};

// Legacy Helper to extract code from CoT responses (kept for non-code gen functions if needed, though sanitize is better)
const extractCode = (text: string): string => {
  if (!text) return "";
  const codeTagMatch = text.match(/<code>([\s\S]*?)<\/code>/);
  if (codeTagMatch) return codeTagMatch[1].trim();
  return text.replace(/```(sql|python)?/g, '').replace(/```/g, '').trim();
};

async function logPrompt(type: string, content: string) {
  // Browser Console Log
  console.groupCollapsed(`%c[AI Prompt] ${type}`, 'color: #2563eb; font-weight: bold;');
  console.log(content);
  console.groupEnd();

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

async function callAliyun(messages: { role: string; content: string }[], temperature = 0.7, jsonMode = false, model = 'qwen-flash') {
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
      model: model,
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

  // Log Token Usage
  if (data.usage) {
    const { prompt_tokens, completion_tokens, total_tokens } = data.usage;
    console.groupCollapsed(`%c[Token Usage] Aliyun (${model})`, 'color: #059669; font-weight: bold;');
    console.log(`Prompt Tokens:     ${prompt_tokens}`);
    console.log(`Completion Tokens: ${completion_tokens}`);
    console.log(`Total Tokens:      ${total_tokens}`);
    console.groupEnd();
  }

  return data.choices[0].message.content;
}

export const analyzeHeaders = async (sample: any[][]): Promise<{ hasHeader: boolean; headers: string[] }> => {
  const safeSample = sanitizeSample(sample, 5, 200);
  const userContent = USER_PROMPTS.HEADER_ANALYSIS(safeSample);
  const messages = [
    { role: "system", content: SYSTEM_PROMPTS.HEADER_ANALYSIS },
    { role: "user", content: userContent }
  ];

  await logPrompt('HEADER_ANALYSIS', `System: ${SYSTEM_PROMPTS.HEADER_ANALYSIS}\nUser: ${userContent}`);

  try {
    const responseText = await callAliyun(messages, 0.2, true);
    return JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (err) {
    console.warn("AI Header analysis failed, falling back to basic headers", err);
    return { hasHeader: true, headers: sample[0].map(s => String(s)) };
  }
};

export const generateTopic = async (currentTopic: string, tables: TableMetadata[]): Promise<string> => {
  const systemInstruction = SYSTEM_PROMPTS.TOPIC_GEN(tables);
  const userContent = USER_PROMPTS.TOPIC_GEN(currentTopic);
  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: userContent }
  ];

  await logPrompt('TOPIC_GEN', `System: ${systemInstruction}\nUser: ${userContent}`);

  const responseText = await callAliyun(messages, 0.3);
  return responseText.replace(/['"“”]/g, '').trim().substring(0, 10);
};

export const generateCode = async (prompt: string, mode: DevMode, tables: TableMetadata[]): Promise<{ code: string; thought: string }> => {
  const systemInstruction = SYSTEM_PROMPTS.CODE_GEN(mode, tables);
  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: prompt }
  ];

  await logPrompt(`CODE_GEN_${mode}`, `System: ${systemInstruction}\nUser: ${prompt}`);

  const responseText = await callAliyun(messages, 0.1, false, 'qwen-coder-plus-1106');
  return parseCoTResponse(responseText);
};

export const refineCode = async (
  prompt: string, 
  mode: DevMode, 
  tables: TableMetadata[], 
  currentCode: string, 
  lastResult?: ExecutionResult | null,
  previousPrompt?: string | null
): Promise<{ code: string; thought: string }> => {
  const systemInstruction = SYSTEM_PROMPTS.REFINE_CODE(mode, tables);
  
  // Construct Runtime Context
  let runtimeContext = "No previous execution data available.";
  if (lastResult) {
    if (lastResult.isError) {
      const logs = lastResult.logs?.join('\n') || 'Unknown error';
      runtimeContext = `⚠️ LAST EXECUTION FAILED:\n${logs.substring(0, 1000)}`;
    } else if (lastResult.data && lastResult.data.length > 0) {
      const safeSample = sanitizeSample(lastResult.data, 3, 50);
      runtimeContext = `✅ LAST EXECUTION SUCCESSFUL:\nColumns: ${lastResult.columns.join(', ')}\nResult Sample (Top 3):\n${JSON.stringify(safeSample, null, 2)}`;
    } else {
      runtimeContext = "✅ LAST EXECUTION SUCCESSFUL (No Data Returned).";
    }
  }

  const userContent = USER_PROMPTS.REFINE_CONTEXT(prompt, currentCode, mode, runtimeContext, previousPrompt || undefined);

  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: userContent }
  ];

  await logPrompt(`REFINE_CODE_${mode}`, `System: ${systemInstruction}\nUser: ${userContent}`);

  const responseText = await callAliyun(messages, 0.1, false, 'qwen-coder-plus-1106');
  return parseCoTResponse(responseText);
};

export const debugCode = async (prompt: string, mode: DevMode, tables: TableMetadata[], code: string, error: string): Promise<{ code: string; thought: string }> => {
  const systemInstruction = SYSTEM_PROMPTS.DEBUG_CODE(mode, tables);
  const safeError = error.length > 2000 ? error.substring(0, 2000) + '\n...(truncated logs)' : error;
  
  // Use the new structured template
  const userContent = USER_PROMPTS.DEBUG_CONTEXT(prompt, code, safeError);

  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: userContent }
  ];

  await logPrompt(`DEBUG_CODE_${mode}`, `System: ${systemInstruction}\nUser: ${userContent}`);

  const responseText = await callAliyun(messages, 0.1, false, 'qwen-coder-plus-1106');
  return parseCoTResponse(responseText);
};

export const inferColumnMetadata = async (tableName: string, data: any[]): Promise<Record<string, string>> => {
  if (!data || data.length === 0) return {};
  
  const safeSample = sanitizeSample(data, 5, 200);
  const headers = Object.keys(data[0]);

  const userContent = USER_PROMPTS.METADATA_INFER(tableName, headers, safeSample);
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
  
  const safeResult = sanitizeSample(result, 5, 300);

  const userContent = `
${prompt ? `Business Requirement: ${prompt}` : ''}
Executed SQL: ${query}
Result Data (Sample): ${JSON.stringify(safeResult)}
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
  const safeSample = sanitizeSample(result, 10, 100);

  const userContent = USER_PROMPTS.CHART_REC(query, columns, safeSample);
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

export const generateSuggestions = async (tables: TableMetadata[], topic: string, existingSuggestions: Suggestion[] = []): Promise<Suggestion[]> => {
  const systemInstruction = SYSTEM_PROMPTS.SUGGESTIONS(topic, tables, existingSuggestions);
  
  const userContent = `Analyze the schema provided in the system instructions and generate 8 distinct ideas (4 SQL, 4 Python).`;
  
  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: userContent }
  ];

  await logPrompt('SUGGESTIONS', `System: ${systemInstruction}\nUser: ${userContent}`);

  try {
    const responseText = await callAliyun(messages, 0.7, true);
    const data = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
    return (data.suggestions || []).map((s: any) => ({
      id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
