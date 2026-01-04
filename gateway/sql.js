
import { getPool } from './database.js';
import { IS_DEBUG } from './common.js';

/**
 * Detects image MIME type based on Magic Numbers (File Signatures).
 * @param {Buffer} buffer 
 * @returns {string} Mime Type (e.g., 'image/png') or 'application/octet-stream'
 */
function detectImageMime(buffer) {
  if (!buffer || buffer.length < 4) return 'application/octet-stream';

  // Convert first 12 bytes to hex for checking
  const signature = buffer.toString('hex', 0, 12).toUpperCase();

  if (signature.startsWith('89504E47')) {
    return 'image/png';
  }
  if (signature.startsWith('FFD8FF')) {
    return 'image/jpeg';
  }
  if (signature.startsWith('47494638')) {
    return 'image/gif';
  }
  if (signature.startsWith('424D')) {
    return 'image/bmp';
  }
  // WebP: RIFF (52494646) ... WEBP (57454250) at offset 8
  if (signature.startsWith('52494646') && signature.slice(16, 24) === '57454250') {
    return 'image/webp';
  }
  // ICO: 00000100
  if (signature.startsWith('00000100')) {
    return 'image/x-icon';
  }

  // Fallback: If strict type isn't found, default to png if usually expected, 
  // or octet-stream. For this specific Excel use case, png is a safe fallback 
  // as ExcelJS extraction often normalizes, but let's be generic.
  return 'application/octet-stream'; 
}

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
      
      // 4. Post-processing: Convert Buffers (BLOBs) to Base64 strings for image rendering
      if (Array.isArray(activeRows)) {
        activeRows = activeRows.map(row => {
          const newRow = { ...row };
          for (const key in newRow) {
            if (Buffer.isBuffer(newRow[key])) {
              // Dynamically detect MIME type
              const mimeType = detectImageMime(newRow[key]);
              
              // Only convert to Data URI if it looks like an image, otherwise leave as base64 string
              // or handle generically. Here we assume BLOBs in this context are likely images 
              // given the "Excel Image Import" feature.
              if (mimeType.startsWith('image/')) {
                 newRow[key] = `data:${mimeType};base64,${newRow[key].toString('base64')}`;
              } else {
                 // For non-images, we might want to just show a placeholder or hex dump, 
                 // but returning base64 allows frontend to decide (or download).
                 // For now, let's treat unknown as potential png fallback to ensure frontend tries to render,
                 // or just stringify.
                 newRow[key] = `[BINARY DATA: ${newRow[key].length} bytes]`;
              }
            }
          }
          return newRow;
        });
      }

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
