
import { DevMode, Suggestion, TableMetadata } from "../types";
import i18next from "i18next";

// Import Fragments
import pythonBridgeApi from '../prompts/fragments/python_bridge_api.md?raw';
import sqlDialectMysql from '../prompts/fragments/sql_dialect_mysql.md?raw';
import sqlDialectPostgres from '../prompts/fragments/sql_dialect_postgres.md?raw';

import cotProtocol from '../prompts/fragments/cot_protocol.md?raw';

// Import Templates
import codeGenPython from '../prompts/templates/code_gen_python.md?raw';
import codeGenSql from '../prompts/templates/code_gen_sql.md?raw';
import refinePython from '../prompts/templates/refine_python.md?raw';
import refineSql from '../prompts/templates/refine_sql.md?raw';
import refineUserContext from '../prompts/templates/refine_user_context.md?raw';
import debugPython from '../prompts/templates/debug_python.md?raw';
import debugSql from '../prompts/templates/debug_sql.md?raw';
import debugUserContext from '../prompts/templates/debug_user_context.md?raw';
import suggestionsTmpl from '../prompts/templates/suggestions.md?raw';
import topicGenTmpl from '../prompts/templates/topic_gen.md?raw';
import headerAnalysisTmpl from '../prompts/templates/header_analysis.md?raw';
import metadataInferTmpl from '../prompts/templates/metadata_infer.md?raw';
import analysisTmpl from '../prompts/templates/analysis.md?raw';
import chartRecTmpl from '../prompts/templates/chart_rec.md?raw';

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
    
    const headers = t.columns.map(c => c.name);
    
    const headerRow = `| ${headers.join(' | ')} |`;
    const sepRow = `| ${headers.map(() => '---').join(' | ')} |`;
    
    const dataRows = t.sampleData.map(row => {
      return '| ' + headers.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return 'NULL';
        let str = String(val);
        if (str.length > 256) str = str.substring(0, 256) + '...';
        str = str.replace(/\n/g, ' ').replace(/\r/g, '').replace(/\|/g, '\\|');
        return str;
      }).join(' | ') + ' |';
    }).join('\n');

    return `### Table: ${t.tableName}\n${headerRow}\n${sepRow}\n${dataRows}`;
  }).filter(s => s).join('\n\n');
};

const getSqlDialectFragment = () => {
    const dbType = (typeof process !== 'undefined' ? process.env.DB_TYPE : 'mysql') || 'mysql';
    if (dbType === 'postgres') {
        return sqlDialectPostgres; 
    }
    return sqlDialectMysql;
};

const getLanguageReq = () => {
    const lang = i18next.language;
    if (lang === 'zh-CN') return "Language Requirement: All string fields and analysis descriptions should be in Simplified Chinese.";
    if (lang === 'zh-TW') return "Language Requirement: All string fields and analysis descriptions should be in Traditional Chinese.";
    if (lang === 'ja') return "Language Requirement: All string fields and analysis descriptions should be in Japanese.";
    return "Language Requirement: All string fields and analysis descriptions should be in English.";
};

const fillTemplate = (template: string, replacements: Record<string, string>) => {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  result = result.replace('{{PYTHON_BRIDGE_API}}', pythonBridgeApi);
  // Dynamic SQL Dialect Injection
  result = result.replace('{{SQL_DIALECT_MYSQL}}', getSqlDialectFragment());
  result = result.replace('{{COT_PROTOCOL}}', cotProtocol);
  
  // Dynamic Language Requirement
  result = result.replace('{{LANGUAGE_REQ}}', getLanguageReq());
  return result;
};

export const SYSTEM_PROMPTS = {
  CODE_GEN: (mode: DevMode, tables: TableMetadata[]) => {
    const schema = formatSchema(tables);
    const sampleData = formatSampleData(tables);
    const template = mode === DevMode.SQL ? codeGenSql : codeGenPython;
    return fillTemplate(template, { SCHEMA: schema, SAMPLE_DATA: sampleData });
  },

  REFINE_CODE: (mode: DevMode, tables: TableMetadata[]) => {
    const schema = formatSchema(tables);
    const template = mode === DevMode.SQL ? refineSql : refinePython;
    return fillTemplate(template, { SCHEMA: schema });
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
  REFINE_CONTEXT: (instruction: string, code: string, mode: DevMode, runtimeContext: string, previousPrompt?: string) => {
    return fillTemplate(refineUserContext, {
        INSTRUCTION: instruction,
        CODE: code,
        RUNTIME_CONTEXT: runtimeContext,
        PREVIOUS_PROMPT: previousPrompt || "Unknown (Code might be manually written or this is the first iteration)",
        LANGUAGE: mode === DevMode.SQL ? 'sql' : 'python'
    });
  },

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
