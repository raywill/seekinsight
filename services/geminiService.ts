import { GoogleGenAI, Type } from "@google/genai";
import { TableMetadata, DevMode, Suggestion, AIChartConfig } from "../types";
import { SYSTEM_PROMPTS, USER_PROMPTS } from "./prompts";

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

// Helper to extract code from CoT responses
const extractCode = (text: string): string => {
  if (!text) return "";
  // 1. Try extracting from <code> tags (CoT protocol)
  const codeTagMatch = text.match(/<code>([\s\S]*?)<\/code>/);
  if (codeTagMatch) {
    return codeTagMatch[1].trim();
  }
  // 2. Fallback to standard markdown blocks
  return text.replace(/```(sql|python)?/g, '').replace(/```/g, '').trim();
};

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
  const safeSample = sanitizeSample(sample, 5, 200);
  const userContent = USER_PROMPTS.HEADER_ANALYSIS(safeSample);
  
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
  const systemInstruction = SYSTEM_PROMPTS.CODE_GEN(mode, tables);
  await logPrompt(`CODE_GEN_${mode}`, `System: ${systemInstruction}\nUser: ${prompt}`);

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.1,
    },
  });

  return extractCode(response.text || "");
};

export const debugCode = async (
  prompt: string, 
  mode: DevMode, 
  tables: TableMetadata[],
  code: string,
  error: string
): Promise<string> => {
  const systemInstruction = SYSTEM_PROMPTS.DEBUG_CODE(mode, tables);
  const safeError = error.length > 2000 ? error.substring(0, 2000) + '\n...(truncated logs)' : error;
  
  // Use the new structured template
  const userContent = USER_PROMPTS.DEBUG_CONTEXT(prompt, code, safeError);

  await logPrompt(`DEBUG_CODE_${mode}`, `System: ${systemInstruction}\nUser: ${userContent}`);

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: userContent,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.1,
    },
  });

  return extractCode(response.text || "");
};

export const inferColumnMetadata = async (tableName: string, data: any[]): Promise<Record<string, string>> => {
  if (!data || data.length === 0) return {};

  const safeSample = sanitizeSample(data, 5, 200);
  const headers = Object.keys(data[0]);

  const userContent = USER_PROMPTS.METADATA_INFER(tableName, headers, safeSample);
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

export const generateAnalysis = async (query: string, result: any[], topic: string, prompt?: string): Promise<string> => {
  if (!result || result.length === 0) return "No data returned to analyze.";
  
  const safeResult = sanitizeSample(result, 5, 300);

  const userContent = `
${prompt ? `Business Requirement: ${prompt}` : ''}
Executed SQL: ${query}
Result Data (Sample): ${JSON.stringify(safeResult)}
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
  
  const safeSample = sanitizeSample(result, 10, 100);

  const userContent = USER_PROMPTS.CHART_REC(query, columns, safeSample);
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
  const systemInstruction = SYSTEM_PROMPTS.SUGGESTIONS(topic, tables, existingSuggestions);
  
  const userContent = `Analyze the schema provided in the system instructions and generate 8 distinct ideas (4 SQL, 4 Python).`;
  
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
      id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: s.type?.toUpperCase() === 'SQL' ? DevMode.SQL : DevMode.PYTHON
    }));
  } catch (err) {
    console.error("Gemini suggestion parsing failed", err);
    return [];
  }
};

export const generateTopic = async (currentTopic: string, tables: TableMetadata[]): Promise<string> => {
  const systemInstruction = SYSTEM_PROMPTS.TOPIC_GEN(tables);
  const userContent = USER_PROMPTS.TOPIC_GEN(currentTopic);
  
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