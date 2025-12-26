
import { PublishedApp, DevMode, ExecutionResult } from '../types';

const GATEWAY_URL = (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';

export const fetchApps = async (): Promise<PublishedApp[]> => {
  try {
    const res = await fetch(`${GATEWAY_URL}/apps`);
    if (!res.ok) throw new Error('Failed to fetch apps');
    const apps = await res.json();
    return apps.map((app: any) => ({
      ...app,
      // Enrich with visual metadata (mocked for now, or could be stored)
      icon: app.type === DevMode.SQL ? 'BarChart3' : 'Code2',
      color: app.type === DevMode.SQL ? '#3B82F6' : '#8B5CF6',
      category: app.type === DevMode.SQL ? 'Dashboard' : 'Algorithm'
    }));
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const publishApp = async (
  title: string,
  description: string,
  author: string,
  type: DevMode,
  code: string,
  source_db_name: string,
  params_schema?: any,
  resultSnapshot?: ExecutionResult
): Promise<string> => {
  const res = await fetch(`${GATEWAY_URL}/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description,
      author,
      type,
      code,
      source_db_name,
      params_schema: params_schema ? JSON.stringify(params_schema) : null,
      snapshot_json: resultSnapshot ? JSON.stringify(resultSnapshot) : null
    })
  });
  
  if (!res.ok) throw new Error("Publish failed");
  const data = await res.json();
  return data.id;
};
