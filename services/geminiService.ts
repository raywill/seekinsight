
import { GoogleGenAI, Type } from "@google/genai";
import { TableMetadata, DevMode, Suggestion } from "../types";

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

  const systemInstruction = mode === DevMode.SQL 
    ? `You are an expert SQL analyst for SeekInsight. Generate valid MySQL/OceanBase compatible SQL. 
       - Always use backticks for table and column names (e.g., \`table\`.\`column\`).
       - Use the provided column comments to understand the semantic meaning of data.
       - Only return the raw SQL code without any markdown blocks or explanations.
       
       Available Schema:\n${schemaStr}`
    : `You are a Python data scientist. Use pandas for data analysis. 
       - You have a built-in function sql(query) that returns a pandas DataFrame.
       - Use the column comments to guide your feature engineering or analysis.
       - Only return the raw Python code.
       
       Available Schema:\n${schemaStr}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction,
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

  const prompt = `Task: Generate brief semantic descriptions (comments) for each column in a database table.
Table Name: ${tableName}
Headers: ${headers.join(', ')}
Sample Data (JSON): ${JSON.stringify(sample)}

Return a JSON object where keys are column names and values are short, professional descriptions of what the data represents.
Example: {"user_id": "Unique identifier for the customer", "amount": "Total transaction value in USD"}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
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

  const prompt = `Based on the SQL/Python logic: "${query}" and the resulting data (top 5 rows): ${JSON.stringify(result.slice(0, 5))}, provide a professional executive summary and 3 actionable data insights in Markdown format.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: "You are a senior data architect and business analyst. Be concise, professional, and data-driven.",
      temperature: 0.5,
    }
  });

  return response.text || "";
};

export const generateSuggestions = async (tables: TableMetadata[]): Promise<Suggestion[]> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}
Columns: ${t.columns.map(c => `${c.name} (${c.type}: ${c.comment})`).join(', ')}`
  ).join('\n\n');

  const prompt = `Based on the following schema, generate 8 data analysis ideas. 
4 SQL-based and 4 Python-based.

Schema:
${schemaStr}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
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
                type: { type: Type.STRING, description: "Must be 'SQL' or 'PYTHON'" }
              },
              required: ["id", "title", "prompt", "category", "type"]
            }
          }
        },
        required: ["suggestions"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return (data.suggestions || []).map((s: any) => ({
      ...s,
      type: s.type === 'SQL' ? DevMode.SQL : DevMode.PYTHON
    }));
  } catch (err) {
    console.error("Gemini suggestion parsing failed", err);
    return [];
  }
};
