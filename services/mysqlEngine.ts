
import { DatabaseEngine } from "./dbService";
import { ExecutionResult, TableMetadata, Column } from "../types";

export class MySQLEngine implements DatabaseEngine {
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
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = '${dbName}' 
        AND TABLE_NAME NOT LIKE '\\_\\_%'
      `, dbName);
      
      if (tablesInfoRes.data.length === 0) return [];

      const columnsInfoRes = await this.executeQuery(`
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = '${dbName}'
        AND TABLE_NAME NOT LIKE '\\_\\_%'
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `, dbName);

      const columnsByTable: Record<string, Column[]> = {};
      columnsInfoRes.data.forEach(row => {
        if (!columnsByTable[row.TABLE_NAME]) columnsByTable[row.TABLE_NAME] = [];
        columnsByTable[row.TABLE_NAME].push({
          name: row.COLUMN_NAME,
          type: row.DATA_TYPE.toUpperCase(),
          comment: row.COLUMN_COMMENT || ''
        });
      });

      return tablesInfoRes.data.map(row => ({
        id: Math.random().toString(36).substr(2, 9),
        tableName: row.TABLE_NAME,
        columns: columnsByTable[row.TABLE_NAME] || [],
        rowCount: -1 
      }));
    } catch (err) {
      console.warn("Failed to load tables:", err);
      return [];
    }
  }

  async refreshTableStats(tableName: string, dbName: string): Promise<number> {
    const res = await this.executeQuery(`SELECT COUNT(*) as cnt FROM \`${tableName}\``, dbName);
    const count = parseInt(res.data[0].cnt || 0);
    return count;
  }

  /**
   * High-precision Date formatter for MySQL/OceanBase (YYYY-MM-DD HH:MM:SS.ffffff)
   */
  private formatDateForMySQL(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
           `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${ms}000`;
  }

  /**
   * Formats a value for SQL insertion, ensuring robust type handling.
   */
  private formatValueForSql(val: any): string {
    if (val === null || val === undefined) return 'NULL';

    // Robust Date detection using prototype string
    const isDate = Object.prototype.toString.call(val) === '[object Date]';
    if (isDate && !isNaN(val.getTime())) {
      return `'${this.formatDateForMySQL(val)}'`;
    }

    if (typeof val === 'string') {
      // Check for date-like string (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return `'${val} 00:00:00.000000'`;
      }
      return `'${val.replace(/'/g, "''")}'`;
    }

    if (typeof val === 'number') {
      return isNaN(val) ? 'NULL' : val.toString();
    }

    if (typeof val === 'boolean') {
      return val ? '1' : '0';
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
    
    // 1. Scan for Max Length per Column (Inference)
    // We scan ALL rows to determine the appropriate SQL type to avoid truncation on outlier rows
    const maxLengths: Record<string, number> = {};
    
    // Initialize maxLengths
    for (const key of originalKeys) {
      maxLengths[key] = 0;
    }

    // Perform full scan for string lengths
    for (let i = 0; i < data.length; i++) {
      for (const key of originalKeys) {
        const val = data[i][key];
        if (typeof val === 'string') {
          const len = val.length;
          if (len > maxLengths[key]) {
            maxLengths[key] = len;
          }
        }
      }
    }

    // 2. Infer Columns and Types based on Data and Max Length
    const columns: Column[] = originalKeys.map(key => {
      // Find first non-null value for type inference fallback
      let firstVal = data[0][key];
      for(let i=0; i < data.length; i++) {
        if (data[i][key] !== null && data[i][key] !== undefined) {
          firstVal = data[i][key];
          break;
        }
      }

      const maxLen = maxLengths[key];
      let inferredType = 'VARCHAR(255)';

      const isDate = Object.prototype.toString.call(firstVal) === '[object Date]';
      
      if (isDate && !isNaN(firstVal.getTime())) {
        inferredType = 'DATETIME(6)';
      } 
      else if (typeof firstVal === 'number') {
        inferredType = 'DOUBLE';
      }
      else if (typeof firstVal === 'string') {
        // Fix: Prioritize length check over date pattern to avoid 'Data too long' errors
        // Fix: Use 191 as threshold for VARCHAR to be safe with utf8mb4 indexing limits
        if (maxLen > 16777215) {
          inferredType = 'LONGTEXT';
        } else if (maxLen > 65535) {
          inferredType = 'MEDIUMTEXT';
        } else if (maxLen > 191) {
          inferredType = 'TEXT';
        } else if (/^\d{4}-\d{2}-\d{2}/.test(firstVal) && maxLen <= 30) {
          // Only infer Date if max length is reasonable
          inferredType = 'DATETIME(6)';
        } else {
          inferredType = 'VARCHAR(255)';
        }
      }

      return {
        name: key.trim(),
        type: inferredType,
        comment: aiComments?.[key] || `Imported: ${key}`
      };
    });

    // 3. Execute DDL
    const ddlCols = columns.map(c => `\`${c.name}\` ${c.type} COMMENT '${c.comment.replace(/'/g, "''")}'`).join(", ");
    await this.executeQuery(`DROP TABLE IF EXISTS \`${trimmedName}\``, dbName);
    await this.executeQuery(`CREATE TABLE \`${trimmedName}\` (${ddlCols})`, dbName);

    // 4. Batch Insertion
    const cleanedKeys = columns.map(c => c.name);
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const chunk = data.slice(i, i + batchSize);
      const valuesList = chunk.map(row => 
        `(${originalKeys.map(k => this.formatValueForSql(row[k])).join(',')})`
      ).join(',');
      
      await this.executeQuery(`INSERT INTO \`${trimmedName}\` (\`${cleanedKeys.join('`,`')}\`) VALUES ${valuesList}`, dbName);
      
      if (onProgress) {
        const percent = Math.min(100, Math.round(((i + chunk.length) / data.length) * 100));
        onProgress(percent);
      }
    }

    return {
      id: Math.random().toString(36).substr(2, 9),
      tableName: trimmedName,
      columns,
      rowCount: data.length
    };
  }
}
