
import { GoogleGenAI, Type } from "@google/genai";
import { TableMetadata, DevMode, Suggestion, AIChartConfig } from "../types";
import { SYSTEM_PROMPTS, USER_PROMPTS } from "./prompts";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPTS.CODE_GEN(mode, schemaStr),
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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: USER_PROMPTS.METADATA_INFER(tableName, headers, sample),
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
export const generateAnalysis = async (query: string, result: any[]): Promise<string> => {
  if (!result || result.length === 0) return "No data returned to analyze.";
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Query: ${query}\nSample: ${JSON.stringify(result.slice(0, 5))}`,
    config: {
      systemInstruction: SYSTEM_PROMPTS.ANALYSIS,
      temperature: 0.5,
    }
  });

  return response.text || "";
};

export const recommendCharts = async (query: string, result: any[]): Promise<AIChartConfig[]> => {
  if (!result || result.length === 0) return [];
  const columns = Object.keys(result[0]);
  const sample = result.slice(0, 10);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: USER_PROMPTS.CHART_REC(query, columns, sample),
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

export const generateSuggestions = async (tables: TableMetadata[]): Promise<Suggestion[]> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}\nColumns: ${t.columns.map(c => `${c.name} (${c.type})`).join(', ')}`
  ).join('\n\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Database Schema:\n${schemaStr}`,
      config: {
        systemInstruction: SYSTEM_PROMPTS.SUGGESTIONS,
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
      type: s.type?.toUpperCase() === 'SQL' ? DevMode.SQL : DevMode.PYTHON
    }));
  } catch (err) {
    console.error("Gemini suggestion parsing failed", err);
    return [];
  }
};
