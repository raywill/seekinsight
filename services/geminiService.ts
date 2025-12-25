
import { GoogleGenAI, Type } from "@google/genai";
import { TableMetadata, DevMode, Suggestion, AIChartConfig } from "../types";
import { SYSTEM_PROMPTS, USER_PROMPTS } from "./prompts";

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

export const analyzeHeaders = async (sample: any[][]): Promise<{ hasHeader: boolean; headers: string[] }> => {
  const userContent = USER_PROMPTS.HEADER_ANALYSIS(sample);
  await logPrompt('HEADER_ANALYSIS', `System: ${SYSTEM_PROMPTS.HEADER_ANALYSIS}\nUser: ${userContent}`);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userContent,
      config: {
        systemInstruction: SYSTEM_PROMPTS.HEADER_ANALYSIS,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasHeader: { type: Type.BOOLEAN },
            headers: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["hasHeader", "headers"]
        }
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (err) {
    console.warn("Gemini Header analysis failed:", err);
    return { hasHeader: true, headers: sample[0].map(s => String(s)) };
  }
};

/**
 * Uses Gemini 3 Pro for high-precision code generation.
 */
export const generateCode = async (
  prompt: string, 
  mode: DevMode, 
  tables: TableMetadata[]
): Promise<string> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}
Columns:
${t.columns.map(c => `- ${c.name} (${c.type}): ${c.comment || 'No description'}`).join('\n')}`
  ).join('\n\n');

  const systemInstruction = SYSTEM_PROMPTS.CODE_GEN(mode, schemaStr);
  await logPrompt(`CODE_GEN_${mode}`, `System: ${systemInstruction}\nUser: ${prompt}`);

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.1,
    },
  });

  const text = response.text || "";
  return text.replace(/```(sql|python)?/g, '').replace(/```/g, '').trim();
};

export const debugCode = async (
  prompt: string, 
  mode: DevMode, 
  tables: TableMetadata[],
  code: string,
  error: string
): Promise<string> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}
Columns:
${t.columns.map(c => `- ${c.name} (${c.type}): ${c.comment || 'No description'}`).join('\n')}`
  ).join('\n\n');

  const systemInstruction = SYSTEM_PROMPTS.DEBUG_CODE(mode, schemaStr);
  const userContent = `Original Prompt: ${prompt}\n\nFaulty Code:\n${code}\n\nExecution Error:\n${error}`;
  await logPrompt(`DEBUG_CODE_${mode}`, `System: ${systemInstruction}\nUser: ${userContent}`);

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: userContent,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.1,
    },
  });

  const text = response.text || "";
  return text.replace(/```(sql|python)?/g, '').replace(/```/g, '').trim();
};

/**
 * Infers semantic comments for columns based on headers and sample data.
 */
export const inferColumnMetadata = async (tableName: string, data: any[]): Promise<Record<string, string>> => {
  if (!data || data.length === 0) return {};

  const sampleSize = Math.min(data.length, 5);
  const sample = data.slice(0, sampleSize);
  const headers = Object.keys(data[0]);

  const userContent = USER_PROMPTS.METADATA_INFER(tableName, headers, sample);
  await logPrompt('METADATA_INFER', `System: ${SYSTEM_PROMPTS.METADATA_INFER}\nUser: ${userContent}`);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userContent,
      config: {
        systemInstruction: SYSTEM_PROMPTS.METADATA_INFER,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: headers.reduce((acc: any, header) => {
            acc[header] = { type: Type.STRING };
            return acc;
          }, {}),
          required: headers,
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (err) {
    console.error("AI Metadata Inference failed:", err);
    return {};
  }
};

/**
 * Uses Gemini 3 Flash for quick summarization and analysis.
 */
export const generateAnalysis = async (query: string, result: any[], topic: string, prompt?: string): Promise<string> => {
  if (!result || result.length === 0) return "No data returned to analyze.";
  
  const userContent = `
${prompt ? `Business Requirement: ${prompt}` : ''}
Executed SQL: ${query}
Result Data (Sample): ${JSON.stringify(result.slice(0, 5))}
  `.trim();
  
  const systemInstruction = SYSTEM_PROMPTS.ANALYSIS(topic);
  await logPrompt('ANALYSIS', `System: ${systemInstruction}\nUser: ${userContent}`);
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: userContent,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.5,
    }
  });

  return response.text || "";
};

export const recommendCharts = async (query: string, result: any[]): Promise<AIChartConfig[]> => {
  if (!result || result.length === 0) return [];
  const columns = Object.keys(result[0]);
  const sample = result.slice(0, 10);

  const userContent = USER_PROMPTS.CHART_REC(query, columns, sample);
  await logPrompt('CHART_REC', `System: ${SYSTEM_PROMPTS.CHART_REC}\nUser: ${userContent}`);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userContent,
      config: {
        systemInstruction: SYSTEM_PROMPTS.CHART_REC,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            charts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  xKey: { type: Type.STRING },
                  yKeys: { type: Type.ARRAY, items: { type: Type.STRING } },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["type", "xKey", "yKeys", "title"]
              }
            }
          },
          required: ["charts"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return data.charts || [];
  } catch (err) {
    console.error("Gemini chart recommendation failed", err);
    return [];
  }
};

export const generateSuggestions = async (tables: TableMetadata[], topic: string, existingSuggestions: Suggestion[] = []): Promise<Suggestion[]> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}\nColumns: ${t.columns.map(c => `${c.name} (${c.type})`).join(', ')}`
  ).join('\n\n');

  const userContent = `Database Schema:\n${schemaStr}`;
  const systemInstruction = SYSTEM_PROMPTS.SUGGESTIONS(topic, existingSuggestions);
  await logPrompt('SUGGESTIONS', `System: ${systemInstruction}\nUser: ${userContent}`);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userContent,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  prompt: { type: Type.STRING },
                  category: { type: Type.STRING },
                  type: { type: Type.STRING }
                },
                required: ["id", "title", "prompt", "category", "type"]
              }
            }
          },
          required: ["suggestions"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return (data.suggestions || []).map((s: any) => ({
      ...s,
      // Robust unique ID generation: ai_timestamp_randomString
      id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: s.type?.toUpperCase() === 'SQL' ? DevMode.SQL : DevMode.PYTHON
    }));
  } catch (err) {
    console.error("Gemini suggestion parsing failed", err);
    return [];
  }
};

export const generateTopic = async (currentTopic: string, tables: TableMetadata[]): Promise<string> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}\nColumns: ${t.columns.map(c => `${c.name} (${c.type})`).join(', ')}`
  ).join('\n\n');

  const userContent = USER_PROMPTS.TOPIC_GEN(currentTopic, schemaStr);
  const systemInstruction = SYSTEM_PROMPTS.TOPIC_GEN;
  
  await logPrompt('TOPIC_GEN', `System: ${systemInstruction}\nUser: ${userContent}`);

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: userContent,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.3,
    },
  });

  return (response.text || "").replace(/['"“”]/g, '').trim().substring(0, 10);
};
