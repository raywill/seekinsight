
import { ExecutionResult } from "../types";

const GATEWAY_URL = (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';

export interface PythonResponse extends ExecutionResult {
  schemaData?: any;
}

export const executePython = async (
  code: string, 
  dbName: string, 
  params: Record<string, any> = {}, 
  executionMode: 'EXECUTION' | 'SCHEMA' = 'EXECUTION'
): Promise<PythonResponse> => {
  try {
    const response = await fetch(`${GATEWAY_URL}/python`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        code, 
        dbName, 
        params,
        executionMode 
      })
    });

    const data = await response.json();
    const isError = !response.ok || data.error;

    // Normalize the result structure matching ExecutionResult interface
    return { 
      data: data.data || [], 
      columns: data.columns || [], 
      logs: data.logs || [], 
      plotlyData: data.plotlyData, 
      timestamp: new Date().toLocaleTimeString(), 
      isError,
      schemaData: data.schemaData 
    };
  } catch (err: any) {
    // Return a structured error result instead of throwing, consistent with UI expectations
    return {
      data: [],
      columns: [],
      logs: [`Gateway Error: ${err.message}`],
      timestamp: new Date().toLocaleTimeString(),
      isError: true
    };
  }
};
