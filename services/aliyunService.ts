
import { TableMetadata, DevMode, Suggestion } from "../types";

async function callAliyun(messages: { role: string; content: string }[], temperature = 0.7, jsonMode = false) {
  const API_KEY = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
  const BASE_URL = (typeof process !== 'undefined' ? process.env.API_BASEURL : undefined) || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  if (!API_KEY) {
    throw new Error("Aliyun API Key is missing. Please check your environment variables.");
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
       - Use column comments to understand data semantics.
       - Only return raw SQL code, no markdown blocks.
       - Prefer CTE to subquery
       
       Available Schema:\n${schemaStr}`
    : `You are a Python data scientist. Please write a python script. 
       - Core libraries available: pandas, sqlalchemy, mysql-connector-python, numpy, scipy, scikit-learn, seaborn, plotly.
       - You have a built-in function sql(query) that returns a pandas DataFrame.
       - For visualization, use Plotly. You must call forge_plotly(fig) to send the interactive chart to the UI.
       - Example:
         import plotly.express as px
         df = sql("SELECT * FROM users")
         fig = px.bar(df, x='name', y='age')
         forge_plotly(fig)
       - Do NOT use plt.show() or fig.show().
       - Use scikit-learn for ML tasks if requested.
       - Use seaborn for statistical plotting (static) and plotly for interactive views.
       - Only return raw Python code, no markdown blocks.
       
       Available Schema:\n${schemaStr}`;

  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: prompt }
  ];

  const responseText = await callAliyun(messages, 0.1);
  return responseText.replace(/```(sql|python)?/g, '').replace(/```/g, '').trim();
};

export const inferColumnMetadata = async (tableName: string, data: any[]): Promise<Record<string, string>> => {
  if (!data || data.length === 0) return {};

  const sampleSize = Math.min(data.length, 5);
  const sample = data.slice(0, sampleSize);
  const headers = Object.keys(data[0]);

  const prompt = `Task: Generate brief semantic descriptions (comments) for each column in a table.
Table Name: ${tableName}
Headers: ${headers.join(', ')}
Sample Data: ${JSON.stringify(sample)}

Return a JSON object where keys are column names and values are short, professional descriptions of what the data represents.
Format: {"col1": "description", "col2": "description"}`;

  const messages = [
    { role: "system", content: "You are a data architect. Respond ONLY with a valid JSON object." },
    { role: "user", content: prompt }
  ];

  try {
    const responseText = await callAliyun(messages, 0.3, true);
    const sanitized = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(sanitized);
  } catch (err) {
    console.error("Aliyun Metadata Inference failed:", err);
    return {};
  }
};

export const generateAnalysis = async (query: string, result: any[]): Promise<string> => {
  if (!result || result.length === 0) return "No data returned to analyze.";

  const prompt = `User query: "${query}"
Resulting data (sample): ${JSON.stringify(result.slice(0, 5))}

Provide a professional executive summary and 3 actionable data insights in Markdown format.`;
  
  const messages = [
    { role: "system", content: "You are a senior data analyst. Be concise and professional." },
    { role: "user", content: prompt }
  ];

  return await callAliyun(messages, 0.5);
};

export const generateSuggestions = async (tables: TableMetadata[]): Promise<Suggestion[]> => {
  const schemaStr = tables.map(t => 
    `Table: ${t.tableName}
Columns: ${t.columns.map(c => `${c.name} (${c.type}: ${c.comment})`).join(', ')}`
  ).join('\n\n');

  const prompt = `Based on the following database schema, generate 8 creative data analysis ideas. 
4 should be SQL-based (reporting, aggregation) and 4 should be Python-based (forecasting, correlation, advanced visualization).

Return a JSON object with a "suggestions" key containing an array of objects:
{
  "id": "unique_string",
  "title": "Brief catchy title of the analysis",
  "prompt": "The actual natural language prompt to give to an AI code generator",
  "category": "e.g., Growth, Revenue, Risk, Operations",
  "type": "SQL" or "PYTHON"
}

Schema:
${schemaStr}`;

  const messages = [
    { role: "system", content: "You are a strategic data consultant. Respond ONLY with a valid JSON object." },
    { role: "user", content: prompt }
  ];

  try {
    const responseText = await callAliyun(messages, 0.7, true);
    const sanitized = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(sanitized);
    return (data.suggestions || []).map((s: any) => ({
      ...s,
      type: s.type === 'SQL' ? DevMode.SQL : DevMode.PYTHON
    }));
  } catch (err) {
    console.error("Suggestion generation failed:", err);
    return [];
  }
};
