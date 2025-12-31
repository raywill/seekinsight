
import { getPool } from './database.js';
import { IS_DEBUG } from './common.js';

export default function(app) {
  app.post('/sql', async (req, res) => {
    const { sql, dbName } = req.body;
    if (!dbName) return res.status(400).json({ message: 'Missing dbName' });
    try {
      const pool = await getPool(dbName);
      // mysql2 with multipleStatements: true returns [rows, fields]
      // If multiple queries: rows is array of results, fields is array of fields
      const [result, fields] = await pool.query(sql);

      let activeRows = result;
      let activeFields = fields;
      
      let isMulti = false;
      for (let i = 0; Array.isArray(fields) && i < fields.length; ++i) {
        if (Array.isArray(fields) && undefined === fields[i]) {
           isMulti = true
           break
        }
      }
      // 0. Only process the last query if is multi-statement
      if (isMulti) {
         activeRows = result[result.length - 1];
         activeFields = fields[fields.length - 1];
      }

      // 1. Handle Multi-Statement Execution
      // Scenario 1: Mixed SELECTs or Multiple SELECTs -> fields is [ [Field...], undefined, ... ]
      if (Array.isArray(fields) && Array.isArray(fields[fields.length - 1])) {
           // Grab the LAST result set
           activeRows = result[result.length - 1];
           activeFields = fields[fields.length - 1];
      }
      // Scenario 2: Multiple DMLs -> fields is undefined, result is [ResultSetHeader, ResultSetHeader...]
      // We detect this if result is an array of objects that have 'affectedRows'
      else if (!fields && Array.isArray(result) && result.length > 0 && ('affectedRows' in result[0])) {
           activeRows = result[result.length - 1];
      }

      // 2. Handle DML/DDL (Non-SELECT)
      // If activeRows is a ResultSetHeader (object with affectedRows), transform it into a visible table
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
      // Standardize column extraction from FieldPackets
      const columns = activeFields ? activeFields.map(f => f.name) : (Array.isArray(activeRows) && activeRows.length > 0 ? Object.keys(activeRows[0]) : []);
      
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
