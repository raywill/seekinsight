
import crypto from 'crypto';
import { SYSTEM_DB, SHARE_SNAPSHOTS_TABLE } from './common.js';
import { getPool } from './database.js';

export default function(app) {
  // --- Share Snapshot API ---

  app.post('/shares', async (req, res) => {
    try {
      const { appId, params } = req.body;
      if (!appId) return res.status(400).json({ message: 'App ID required' });
      
      // Generate a short 6-char ID
      const id = crypto.randomBytes(4).toString('hex').substring(0, 8); 
      
      const pool = await getPool(SYSTEM_DB);
      await pool.query(
        `INSERT INTO \`${SHARE_SNAPSHOTS_TABLE}\` (id, app_id, params_json) VALUES (?, ?, ?)`,
        [id, appId, JSON.stringify(params || {})]
      );
      
      res.json({ success: true, id });
    } catch (err) {
      console.error("[Shares POST Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/shares/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getPool(SYSTEM_DB);
      const [rows] = await pool.query(`SELECT params_json FROM \`${SHARE_SNAPSHOTS_TABLE}\` WHERE id = ?`, [id]);
      
      if (rows.length === 0) return res.status(404).json({ message: 'Snapshot not found' });
      
      res.json(JSON.parse(rows[0].params_json || '{}'));
    } catch (err) {
      console.error("[Shares GET Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
