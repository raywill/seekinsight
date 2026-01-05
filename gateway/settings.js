
import { SYSTEM_DB, USER_SETTINGS_TABLE } from './common.js';
import { getPool } from './database.js';

export default function(app) {
  // Get Settings
  app.get('/settings/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const pool = await getPool(SYSTEM_DB);
      const [rows] = await pool.query(`SELECT settings_json FROM \`${USER_SETTINGS_TABLE}\` WHERE user_id = ?`, [userId]);
      
      if (rows.length === 0) {
        return res.json({ autoExecute: false }); // Default
      }
      res.json(JSON.parse(rows[0].settings_json || '{}'));
    } catch (err) {
      console.error("[Settings GET Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Update Settings
  app.put('/settings/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = req.body;
      const pool = await getPool(SYSTEM_DB);
      
      // Upsert logic
      await pool.query(`
        INSERT INTO \`${USER_SETTINGS_TABLE}\` (user_id, settings_json)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json)
      `, [userId, JSON.stringify(settings)]);
      
      res.json({ success: true });
    } catch (err) {
      console.error("[Settings PUT Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
