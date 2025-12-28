
import { DevMode, Suggestion, TableMetadata } from "../types";

// Import Fragments
import pythonBridgeApi from '../prompts/fragments/python_bridge_api.md?raw';
import sqlDialectMysql from '../prompts/fragments/sql_dialect_mysql.md?raw';
import cotProtocol from '../prompts/fragments/cot_protocol.md?raw';
import languageReq from '../prompts/fragments/language_req.md?raw';

// Import Templates
import codeGenPython from '../prompts/templates/code_gen_python.md?raw';
import codeGenSql from '../prompts/templates/code_gen_sql.md?raw';
import debugPython from '../prompts/templates/debug_python.md?raw';
import debugSql from '../prompts/templates/debug_sql.md?raw';
import debugUserContext from '../prompts/templates/debug_user_context.md?raw';
import suggestionsTmpl from '../prompts/templates/suggestions.md?raw';
import topicGenTmpl from '../prompts/templates/topic_gen.md?raw';
import headerAnalysisTmpl from '../prompts/templates/header_analysis.md?raw';
import metadataInferTmpl from '../prompts/templates/metadata_infer.md?raw';
import analysisTmpl from '../prompts/templates/analysis.md?raw';
import chartRecTmpl from '../prompts/templates/chart_rec.md?raw';

// Removed hardcoded LANGUAGE_REQ

const formatSchema = (tables: TableMetadata[]): string => {
  return tables.map(t => {
    const columns = t.columns.map(c => `| ${c.name} | ${c.type} | ${c.comment || ''} |`).join('\n');
    return `
### Table: ${t.tableName}
| Column | Type | Comment |
|---|---|---|
${columns}
    `.trim();
  }).join('\n\n');
};

const formatSampleData = (tables: TableMetadata[]): string => {
  return tables.map(t => {
    if (!t.sampleData || t.sampleData.length === 0) return '';
    
    // Get headers from columns metadata to ensure order
    const headers = t.columns.map(c => c.name);
    
    // Markdown Table Header
    const headerRow = `| ${headers.join(' | ')} |`;
    const sepRow = `| ${headers.map(() => '---').join(' | ')} |`;
    
    // Markdown Data Rows
    const dataRows = t.sampleData.map(row => {
      return '| ' + headers.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return 'NULL';
        let str = String(val);
        // Truncate to 256 chars
        if (str.length > 256) str = str.substring(0, 256) + '...';
        // Sanitize for Markdown table (remove newlines, escape pipes)
        str = str.replace(/\n/g, ' ').replace(/\r/g, '').replace(/\|/g, '\\|');
        return str;
      }).join(' | ') + ' |';
    }).join('\n');

    return `### Table: ${t.tableName}\n${headerRow}\n${sepRow}\n${dataRows}`;
  }).filter(s => s).join('\n\n');
};

const fillTemplate = (template: string, replacements: Record<string, string>) => {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  // Inject Common Fragments globally if not handled
  result = result.replace('{{PYTHON_BRIDGE_API}}', pythonBridgeApi);
  result = result.replace('{{SQL_DIALECT_MYSQL}}', sqlDialectMysql);
  result = result.replace('{{COT_PROTOCOL}}', cotProtocol);
  result = result.replace('{{LANGUAGE_REQ}}', languageReq);
  return result;
};

export const SYSTEM_PROMPTS = {
  CODE_GEN: (mode: DevMode, tables: TableMetadata[]) => {
    const schema = formatSchema(tables);
    const sampleData = formatSampleData(tables);
    const template = mode === DevMode.SQL ? codeGenSql : codeGenPython;
    return fillTemplate(template, { SCHEMA: schema, SAMPLE_DATA: sampleData });
  },

  DEBUG_CODE: (mode: DevMode, tables: TableMetadata[]) => {
    const schema = formatSchema(tables);
    const template = mode === DevMode.SQL ? debugSql : debugPython;
    return fillTemplate(template, { SCHEMA: schema });
  },

  SUGGESTIONS: (topic: string, tables: TableMetadata[], existingSuggestions?: Suggestion[]) => {
    const schema = formatSchema(tables);
    const existing = existingSuggestions && existingSuggestions.length > 0
      ? existingSuggestions.map(s => `- ${s.title}: ${s.prompt}`).join('\n')
      : 'None yet.';
    
    return fillTemplate(suggestionsTmpl, {
      TOPIC: topic,
      SCHEMA: schema,
      EXISTING_IDEAS: existing
    });
  },

  TOPIC_GEN: (tables: TableMetadata[]) => {
    const schema = formatSchema(tables);
    return fillTemplate(topicGenTmpl, { SCHEMA: schema });
  },

  METADATA_INFER: fillTemplate(metadataInferTmpl, {}),

  HEADER_ANALYSIS: fillTemplate(headerAnalysisTmpl, {}),

  ANALYSIS: (topic: string) => fillTemplate(analysisTmpl, { TOPIC: topic }),

  CHART_REC: fillTemplate(chartRecTmpl, {})
};

export const USER_PROMPTS = {
  DEBUG_CONTEXT: (userGoal: string, code: string, errorLog: string) => {
    return fillTemplate(debugUserContext, {
      USER_GOAL: userGoal,
      CODE: code,
      ERROR_LOG: errorLog
    });
  },

  METADATA_INFER: (tableName: string, headers: string[], sample: any) => 
    `Table: ${tableName}\nHeaders: ${headers.join(', ')}\nSample Data: ${JSON.stringify(sample)}`,
    
  HEADER_ANALYSIS: (sample: any[][]) => 
    `Analyze these first 5 rows of a dataset:\n${JSON.stringify(sample)}\n\nIs the first row a header? If not, what should the headers be?`,

  CHART_REC: (query: string, columns: any[], sample: any[]) => 
    `Query: "${query}"\nColumns: ${JSON.stringify(columns)}\nSample Data: ${JSON.stringify(sample)}`,

  TOPIC_GEN: (currentTopic: string) => 
    `Current Topic: ${currentTopic}\n\nSummarize a new topic name based on the schema (max 10 chars):`
};
