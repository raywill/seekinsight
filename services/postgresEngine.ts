
import { DatabaseEngine } from "./dbService";
import { ExecutionResult, TableMetadata, Column } from "../types";

export class PostgresEngine implements DatabaseEngine {
  private ready: boolean = true;
  private gatewayUrl = (typeof process !== 'undefined' && process.env.GATEWAY_URL) || 'http://localhost:3001';

  async init() {
    // No-op, pools managed on gateway
  }

  isReady() {
    return this.ready;
  }

  async executeQuery(sql: string, dbName: string): Promise<ExecutionResult> {
    const response = await fetch(`${this.gatewayUrl}/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, dbName })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "SQL Execution Error");

    return {
      data: result.rows || [],
      columns: result.columns || [],
      timestamp: new Date().toLocaleTimeString()
    };
  }

  async getTables(dbName: string): Promise<TableMetadata[]> {
    try {
      const tablesInfoRes = await this.executeQuery(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name NOT LIKE '\\_\\_%'
      `, dbName);
      
      if (tablesInfoRes.data.length === 0) return [];

      // Update: Join with pg_catalog tables to retrieve column comments
      const columnsInfoRes = await this.executeQuery(`
        SELECT 
            c.table_name, 
            c.column_name, 
            c.data_type, 
            c.udt_name,
            pgd.description as column_comment
        FROM information_schema.columns c
        JOIN pg_catalog.pg_class t ON c.table_name = t.relname
        JOIN pg_catalog.pg_namespace n ON t.relnamespace = n.oid AND n.nspname = c.table_schema
        JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attname = c.column_name
        LEFT JOIN pg_catalog.pg_description pgd ON pgd.objoid = t.oid AND pgd.objsubid = a.attnum
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position
      `, dbName);

      const columnsByTable: Record<string, Column[]> = {};
      columnsInfoRes.data.forEach(row => {
        const tName = row.table_name;
        if (!columnsByTable[tName]) columnsByTable[tName] = [];
        columnsByTable[tName].push({
          name: row.column_name,
          type: row.data_type.toUpperCase(),
          comment: row.column_comment || '' 
        });
      });

      const tables: TableMetadata[] = tablesInfoRes.data.map(row => ({
        id: Math.random().toString(36).substr(2, 9),
        tableName: row.table_name,
        columns: columnsByTable[row.table_name] || [],
        rowCount: -1,
        sampleData: []
      }));

      // Parallel fetch samples
      await Promise.all(tables.map(async (table) => {
         try {
             const res = await this.executeQuery(`SELECT * FROM "${table.tableName}" LIMIT 2`, dbName);
             table.sampleData = res.data;
         } catch(e) {
             console.warn(`Failed to fetch sample for ${table.tableName}`, e);
         }
      }));

      return tables;
    } catch (err) {
      console.warn("Failed to load tables:", err);
      return [];
    }
  }

  async refreshTableStats(tableName: string, dbName: string): Promise<number> {
    const res = await this.executeQuery(`SELECT COUNT(*) as cnt FROM "${tableName}"`, dbName);
    const count = parseInt(res.data[0].cnt || 0);
    return count;
  }

  private formatValueForSql(val: any): string {
    if (val === null || val === undefined) return 'NULL';

    const isDate = Object.prototype.toString.call(val) === '[object Date]';
    if (isDate && !isNaN(val.getTime())) {
      // ISO format works well for Postgres
      return `'${val.toISOString()}'`;
    }

    if (typeof val === 'string') {
      // Escape single quotes for Postgres
      return `'${val.replace(/'/g, "''")}'`;
    }

    if (typeof val === 'number') {
      return isNaN(val) ? 'NULL' : val.toString();
    }

    if (typeof val === 'boolean') {
      return val ? 'TRUE' : 'FALSE';
    }

    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }

  async createTableFromData(
    name: string, 
    data: any[], 
    dbName: string, 
    aiComments?: Record<string, string>,
    onProgress?: (percent: number) => void
  ): Promise<TableMetadata> {
    const trimmedName = name.trim();
    if (!data || data.length === 0) throw new Error("Data is empty");

    const originalKeys = Object.keys(data[0]);
    
    // Type Inference
    const maxLengths: Record<string, number> = {};
    const hasImage: Record<string, boolean> = {};
    
    for (const key of originalKeys) {
      maxLengths[key] = 0;
      hasImage[key] = false;
    }

    for (let i = 0; i < data.length; i++) {
      for (const key of originalKeys) {
        const val = data[i][key];
        if (typeof val === 'string') {
          if (val.startsWith('data:image/')) {
            hasImage[key] = true;
          } else {
            const len = val.length;
            if (len > maxLengths[key]) {
              maxLengths[key] = len;
            }
          }
        }
      }
    }

    const columns: Column[] = originalKeys.map(key => {
      let firstVal = data[0][key];
      for(let i=0; i < data.length; i++) {
        if (data[i][key] !== null && data[i][key] !== undefined) {
          firstVal = data[i][key];
          break;
        }
      }

      let inferredType = 'VARCHAR(255)';

      if (hasImage[key]) {
        inferredType = 'TEXT';
      }
      else {
        const isDate = Object.prototype.toString.call(firstVal) === '[object Date]';
        
        if (isDate && !isNaN(firstVal.getTime())) {
          inferredType = 'TIMESTAMP';
        } 
        else if (typeof firstVal === 'number') {
          inferredType = 'DOUBLE PRECISION';
        }
        else if (typeof firstVal === 'string') {
          if (maxLengths[key] > 255) {
            inferredType = 'TEXT';
          } else if (/^\d{4}-\d{2}-\d{2}/.test(firstVal) && maxLengths[key] <= 30) {
            inferredType = 'TIMESTAMP';
          } else {
            inferredType = 'VARCHAR(255)';
          }
        }
      }

      return {
        name: key.trim(),
        type: inferredType,
        comment: aiComments?.[key] || (hasImage[key] ? `Imported Image` : `Imported: ${key}`)
      };
    });

    // Postgres DDL
    const ddlCols = columns.map(c => `"${c.name}" ${c.type}`).join(", ");
    await this.executeQuery(`DROP TABLE IF EXISTS "${trimmedName}"`, dbName);
    await this.executeQuery(`CREATE TABLE "${trimmedName}" (${ddlCols})`, dbName);
    
    // Add comments for created table columns (Postgres requires separate statements)
    for (const col of columns) {
        if (col.comment) {
            // Escape single quotes in comment
            const safeComment = col.comment.replace(/'/g, "''");
            try {
                await this.executeQuery(`COMMENT ON COLUMN "${trimmedName}"."${col.name}" IS '${safeComment}'`, dbName);
            } catch (e) {
                console.warn(`Failed to set comment for ${col.name}`, e);
            }
        }
    }

    // Batch Insertion
    const cleanedKeys = columns.map(c => c.name);
    const batchSize = 50; 
    for (let i = 0; i < data.length; i += batchSize) {
      const chunk = data.slice(i, i + batchSize);
      const valuesList = chunk.map(row => 
        `(${originalKeys.map(k => this.formatValueForSql(row[k])).join(',')})`
      ).join(',');
      
      await this.executeQuery(`INSERT INTO "${trimmedName}" ("${cleanedKeys.join('","')}") VALUES ${valuesList}`, dbName);
      
      if (onProgress) {
        const percent = Math.min(100, Math.round(((i + chunk.length) / data.length) * 100));
        onProgress(percent);
      }
    }

    return {
      id: Math.random().toString(36).substr(2, 9),
      tableName: trimmedName,
      columns,
      rowCount: data.length,
      sampleData: data.slice(0, 2)
    };
  }
}
