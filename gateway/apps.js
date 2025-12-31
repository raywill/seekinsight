
import crypto from 'crypto';
import { SYSTEM_DB, PUBLISHED_APPS_TABLE } from './common.js';
import { getPool } from './database.js';

export default function(app) {
  // --- Apps API ---

  app.get('/apps', async (req, res) => {
    try {
      const pool = await getPool(SYSTEM_DB);
      // Updated: Order by created_at DESC strictly
      const [rows] = await pool.query(`SELECT * FROM \`${PUBLISHED_APPS_TABLE}\` ORDER BY created_at DESC`);
      res.json(rows);
    } catch (err) {
      console.error("[Apps GET Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/apps/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getPool(SYSTEM_DB);
      const [rows] = await pool.query(`SELECT * FROM \`${PUBLISHED_APPS_TABLE}\` WHERE id = ?`, [id]);
      if (rows.length === 0) return res.status(404).json({ message: 'App not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error("[Apps GET Single Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Increment App View
  app.post('/apps/:id/view', async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getPool(SYSTEM_DB);
      await pool.query(`UPDATE \`${PUBLISHED_APPS_TABLE}\` SET views = views + 1 WHERE id = ?`, [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("[Apps View Increment Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Create New App
  app.post('/apps', async (req, res) => {
    try {
      const { title, description, prompt, author, type, code, source_db_name, source_notebook_id, params_schema, snapshot_json } = req.body;
      const id = crypto.randomBytes(4).toString('hex');
      const pool = await getPool(SYSTEM_DB);
      
      await pool.query(
        `INSERT INTO \`${PUBLISHED_APPS_TABLE}\` (id, title, description, prompt, author, type, code, source_db_name, source_notebook_id, params_schema, snapshot_json, views) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [id, title, description, prompt, author || 'User', type, code, source_db_name, source_notebook_id, params_schema, snapshot_json]
      );
      
      res.json({ success: true, id });
    } catch (err) {
      console.error("[Apps POST Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Update Existing App
  app.put('/apps/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, prompt, author, type, code, source_db_name, source_notebook_id, params_schema, snapshot_json } = req.body;
      const pool = await getPool(SYSTEM_DB);

      const [existing] = await pool.query(`SELECT id FROM \`${PUBLISHED_APPS_TABLE}\` WHERE id = ?`, [id]);
      if (existing.length === 0) return res.status(404).json({ message: 'App not found' });
      
      await pool.query(
        `UPDATE \`${PUBLISHED_APPS_TABLE}\` SET 
          title = ?, 
          description = ?, 
          prompt = ?, 
          author = ?, 
          type = ?, 
          code = ?, 
          source_db_name = ?, 
          source_notebook_id = ?, 
          params_schema = ?, 
          snapshot_json = ? 
        WHERE id = ?`,
        [title, description, prompt, author || 'User', type, code, source_db_name, source_notebook_id, params_schema, snapshot_json, id]
      );
      
      res.json({ success: true, id });
    } catch (err) {
      console.error("[Apps PUT Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/apps/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getPool(SYSTEM_DB);
      await pool.query(`DELETE FROM \`${PUBLISHED_APPS_TABLE}\` WHERE id = ?`, [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("[Apps DELETE Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
