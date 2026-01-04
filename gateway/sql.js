
import { getPool } from './database.js';
import { IS_DEBUG } from './common.js';

export default function(app) {
  app.post('/sql', async (req, res) => {
    const { sql, dbName } = req.body;
    if (!dbName) return res.status(400).json({ message: 'Missing dbName' });
    try {
      const pool = await getPool(dbName);
      // mysql2 with multipleStatements: true returns [rows, fields]
      const [result, fields] = await pool.query(sql);

      let activeRows = result;
      let activeFields = fields;
      
      // 1. Handle Multi-Statement Execution: find the last valid result set
      let isMulti = false;
      // Check if fields is an array of arrays (indicating multiple select results)
      if (Array.isArray(fields) && fields.length > 0 && Array.isArray(fields[0])) {
         isMulti = true;
      }
      
      // If multiple statements, we usually want the last one, or the one that is a result set
      if (isMulti) {
         // Simple heuristic: grab the last result that is an array (SELECT) or the last object (DML)
         activeRows = result[result.length - 1];
         activeFields = fields[fields.length - 1];
      } else if (!fields && Array.isArray(result) && result.length > 0 && ('affectedRows' in result[result.length - 1])) {
         // Multiple DMLs
         activeRows = result[result.length - 1];
      }

      // 2. Handle DML/DDL (Non-SELECT)
      if (activeRows && 'affectedRows' in activeRows && !Array.isArray(activeRows)) {
           return res.json({
              rows: [{
                  status: 'Success',
                  message: activeRows.info || 'Query executed successfully',
                  affected_rows: activeRows.affectedRows,
                  insert_id: activeRows.insertId,
                  warning_count: activeRows.warningStatus
              }],
              columns: ['status', 'message', 'affected_rows', 'insert_id', 'warning_count']
           });
      }

      // 3. Handle Standard SELECT
      const columns = activeFields ? activeFields.map(f => f.name) : (Array.isArray(activeRows) && activeRows.length > 0 ? Object.keys(activeRows[0]) : []);
      
      // No complex binary parsing needed anymore. Images are LONGTEXT data URIs.
      
      res.json({ rows: Array.isArray(activeRows) ? activeRows : [activeRows], columns });

    } catch (err) {
      if (IS_DEBUG) {
        console.error(`[SQL Error in ${dbName}]:`, err.message);
        console.error(`Query: ${sql}`);
      }
      res.status(500).json({ message: err.message });
    }
  });
}
