
import { PublishedApp, DevMode, ExecutionResult, Notebook } from '../types';

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

export const fetchApp = async (id: string): Promise<PublishedApp | null> => {
    try {
        const res = await fetch(`${GATEWAY_URL}/apps/${id}`);
        if (!res.ok) throw new Error('App not found');
        return await res.json();
    } catch (err) {
        console.error(err);
        return null;
    }
}

export const incrementAppViews = async (id: string): Promise<void> => {
    try {
        await fetch(`${GATEWAY_URL}/apps/${id}/view`, { method: 'POST' });
    } catch (err) {
        console.warn("Failed to increment view count", err);
    }
}

export const deleteApp = async (id: string): Promise<boolean> => {
    try {
        const res = await fetch(`${GATEWAY_URL}/apps/${id}`, { method: 'DELETE' });
        return res.ok;
    } catch (err) {
        console.error(err);
        return false;
    }
}

export const publishApp = async (
  title: string,
  description: string,
  author: string,
  type: DevMode,
  code: string,
  source_db_name: string,
  source_notebook_id: string | undefined,
  params_schema?: any,
  resultSnapshot?: ExecutionResult,
  analysisReport?: string,
  prompt?: string
): Promise<string> => {
  
  // Create a composite snapshot containing both result and report
  const compositeSnapshot = {
      result: resultSnapshot,
      analysis: analysisReport
  };

  const res = await fetch(`${GATEWAY_URL}/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description,
      prompt, // Pass prompt to backend
      author,
      type,
      code,
      source_db_name,
      source_notebook_id,
      params_schema: params_schema ? JSON.stringify(params_schema) : null,
      snapshot_json: JSON.stringify(compositeSnapshot)
    })
  });
  
  if (!res.ok) throw new Error("Publish failed");
  const data = await res.json();
  return data.id;
};

export const updateApp = async (
  id: string,
  title: string,
  description: string,
  author: string,
  type: DevMode,
  code: string,
  source_db_name: string,
  source_notebook_id: string | undefined,
  params_schema?: any,
  resultSnapshot?: ExecutionResult,
  analysisReport?: string,
  prompt?: string
): Promise<string> => {
    
    // Create a composite snapshot containing both result and report
    const compositeSnapshot = {
        result: resultSnapshot,
        analysis: analysisReport
    };

    const res = await fetch(`${GATEWAY_URL}/apps/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        prompt,
        author,
        type,
        code,
        source_db_name,
        source_notebook_id,
        params_schema: params_schema ? JSON.stringify(params_schema) : null,
        snapshot_json: JSON.stringify(compositeSnapshot)
      })
    });
    
    if (!res.ok) throw new Error("Update failed");
    const data = await res.json();
    return data.id;
};

export const cloneNotebook = async (
    source_db_name: string, 
    new_topic: string, 
    suggestions_json: string | undefined
): Promise<Notebook> => {
    const res = await fetch(`${GATEWAY_URL}/notebooks/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_db_name, new_topic, suggestions_json })
    });
    
    if (!res.ok) throw new Error("Clone failed");
    return await res.json();
}

export const createShareSnapshot = async (appId: string, params: any): Promise<string> => {
    const res = await fetch(`${GATEWAY_URL}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, params })
    });
    if (!res.ok) throw new Error("Failed to create share link");
    const data = await res.json();
    return data.id;
};

export const getShareSnapshot = async (shareId: string): Promise<any> => {
    const res = await fetch(`${GATEWAY_URL}/shares/${shareId}`);
    if (!res.ok) return null;
    return await res.json();
};
