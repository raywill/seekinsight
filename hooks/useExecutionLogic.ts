
import { DevMode, ProjectState, ExecutionResult, TableMetadata } from '../types';
import { getDatabaseEngine } from '../services/dbService';
import { executePython } from '../services/pythonService';
import * as ai from '../services/aiProvider';

interface ExecutionProps {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
  dbReady: boolean;
  activeModeRef: React.MutableRefObject<DevMode>;
  currentNotebookId: string | undefined;
  gatewayUrl: string;
}

export const useExecutionLogic = ({
  project, setProject, dbReady, activeModeRef, currentNotebookId, gatewayUrl
}: ExecutionProps) => {

  const handleRun = async (codeOverride?: string, modeOverride?: DevMode) => {
    if (!dbReady || !project.dbName) return; 
    
    setProject(prev => ({ ...prev, isExecuting: true, previewResult: null }));
    
    const currentMode = modeOverride || activeModeRef.current || project.activeMode;
    const currentCode = codeOverride || (currentMode === DevMode.SQL ? project.sqlCode : project.pythonCode);
    
    try {
      let result: ExecutionResult;
      if (currentMode === DevMode.SQL) {
        result = await getDatabaseEngine().executeQuery(currentCode, project.dbName);
      } else {
        result = await executePython(currentCode, project.dbName);
      }

      // SI Command Parsing (Layout, etc.)
      if (result.logs && result.logs.length > 0) {
          result.logs.forEach(log => {
              const trimmedLog = log.trim();
              if (trimmedLog.startsWith('__SI_CMD__:')) {
                  try {
                      JSON.parse(trimmedLog.substring('__SI_CMD__:'.length));
                  } catch (e) {}
              }
          });
      }

      setProject(prev => ({
        ...prev,
        isExecuting: false,
        [currentMode === DevMode.SQL ? 'lastSqlResult' : 'lastPythonResult']: result,
        isAnalyzing: currentMode === DevMode.SQL && result.data.length > 0 && !result.isError
      }));

      // Auto Analysis for SQL
      if (currentMode === DevMode.SQL && result.data.length > 0 && !result.isError) {
        ai.generateAnalysis(currentCode, result.data, project.topicName, project.sqlAiPrompt).then(report => {
          setProject(prev => ({ ...prev, analysisReport: report, isAnalyzing: false }));
        });
        setProject(prev => ({ ...prev, isRecommendingCharts: true }));
        ai.recommendCharts(currentCode, result.data).then(charts => {
          setProject(prev => ({ ...prev, lastSqlResult: { ...result, chartConfigs: charts }, isRecommendingCharts: false }));
        });
      }
    } catch (err: any) {
      if (process.env.SI_DEBUG_MODE !== 'false') {
        console.error(`[Execution Error - ${currentMode}]:`, err);
      }
      
      const errorResult: ExecutionResult = {
        data: [],
        columns: [],
        logs: [err.message || "Unknown error occurred during execution"],
        isError: true,
        timestamp: new Date().toLocaleTimeString()
      };

      setProject(prev => ({ 
        ...prev, 
        isExecuting: false, 
        isRecommendingCharts: false, 
        isAnalyzing: false,
        [currentMode === DevMode.SQL ? 'lastSqlResult' : 'lastPythonResult']: errorResult
      }));
    }
  };

  const handleConnectDatabase = async (
    targetDbName: string, 
    setIsConnecting: (v: boolean) => void, 
    setConnectStatus: (v: string) => void,
    onTopicUpdate: (t: string) => void
  ) => {
    if (!currentNotebookId) return;
    setIsConnecting(true);
    setConnectStatus("Initializing connection...");
    
    try {
        const engine = getDatabaseEngine();
        setConnectStatus("Scanning table schema...");
        const tables = await engine.getTables(targetDbName);
        const topTables = tables.slice(0, 10);
        
        const dbType = (typeof process !== 'undefined' ? process.env.DB_TYPE : 'mysql') || 'mysql';
        const q = dbType === 'postgres' ? '"' : '`';
        
        for (const table of topTables) {
            setConnectStatus(`Reading context from table: ${table.tableName}...`);
            const res = await engine.executeQuery(`SELECT * FROM ${q}${table.tableName}${q} LIMIT 5`, targetDbName);
            if (res.data.length > 0) {
                setConnectStatus(`AI enriching metadata for: ${table.tableName}...`);
                const comments = await ai.inferColumnMetadata(table.tableName, res.data);
                await engine.applyColumnComments(table.tableName, comments, targetDbName);
            }
        }

        setConnectStatus("Finalizing connection setup...");
        await fetch(`${gatewayUrl}/notebooks/${currentNotebookId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                db_name: targetDbName,
                is_db_owner: false 
            })
        });

        setProject(prev => ({
            ...prev,
            dbName: targetDbName,
            tables: tables 
        }));
        
        const newTopic = await ai.generateTopic("New Connection", tables);
        onTopicUpdate(newTopic);

    } catch (e: any) {
        console.error("Connect DB Failed", e);
        alert(`Connection Failed: ${e.message}`);
    } finally {
        setIsConnecting(false);
        setConnectStatus("");
    }
  };

  const handleColumnAction = (action: 'fulltext' | 'embedding', tableName: string, columnName: string) => {
      const dbType = (typeof process !== 'undefined' ? process.env.DB_TYPE : 'mysql') || 'mysql';
      
      setProject(prev => {
          let newSqlCode = prev.sqlCode;
          if (action === 'fulltext') {
              if (dbType === 'postgres') {
                  newSqlCode = prev.sqlCode + `\n\n-- Create Full Text Index (Postgres)\nCREATE INDEX "idx_${tableName}_${columnName}" ON "${tableName}" USING GIN (to_tsvector('english', "${columnName}"));\n`;
              } else {
                  newSqlCode = prev.sqlCode + `\n\n-- Create Full Text Index\nCREATE FULLTEXT INDEX \`idx_${tableName}_${columnName}\` ON \`${tableName}\`(\`${columnName}\`);\n`;
              }
          } else if (action === 'embedding') {
              if (dbType === 'postgres') {
                  newSqlCode = prev.sqlCode + `\n\n/* \n  TODO: Generate Vector Embeddings (pgvector) \n  Model: text-embedding-v1\n  Source: ${tableName}.${columnName}\n*/\n-- ALTER TABLE "${tableName}" ADD COLUMN "${columnName}_vector" vector(768);\n`;
              } else {
                  newSqlCode = prev.sqlCode + `\n\n/* \n  TODO: Generate Vector Embeddings \n  Model: text-embedding-v1\n  Source: ${tableName}.${columnName}\n*/\n-- ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}_vector\` VECTOR(768);\n-- UPDATE \`${tableName}\` SET \`${columnName}_vector\` = VECTOR_EMBEDDING('${columnName}');\n`;
              }
          }
          return {
              ...prev,
              activeMode: DevMode.SQL,
              sqlCode: newSqlCode
          };
      });
  };

  return { handleRun, handleConnectDatabase, handleColumnAction };
};
