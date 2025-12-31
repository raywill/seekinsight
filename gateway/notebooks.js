
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { SYSTEM_DB, NOTEBOOK_LIST_TABLE, PUBLISHED_APPS_TABLE, IS_DEBUG } from './common.js';
import { getPool, pools } from './database.js';

export default function(app) {
  // --- Notebook API ---

  app.get('/notebooks', async (req, res) => {
    try {
      const pool = await getPool(SYSTEM_DB);
      const [rows] = await pool.query(`SELECT * FROM \`${NOTEBOOK_LIST_TABLE}\` ORDER BY created_at DESC`);
      res.json(rows);
    } catch (err) {
      if (IS_DEBUG) console.error("[Lobby GET Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Increment Notebook View
  app.post('/notebooks/:id/view', async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getPool(SYSTEM_DB);
      await pool.query(`UPDATE \`${NOTEBOOK_LIST_TABLE}\` SET views = views + 1 WHERE id = ?`, [id]);
      res.json({ success: true });
    } catch (err) {
      if (IS_DEBUG) console.error("[Notebook View Increment Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/notebooks', async (req, res) => {
    try {
      const id = crypto.randomBytes(4).toString('hex');
      const now = new Date();
      const timestamp = now.getFullYear().toString() + 
                        (now.getMonth() + 1).toString().padStart(2, '0') + 
                        now.getDate().toString().padStart(2, '0') + 
                        now.getHours().toString().padStart(2, '0') + 
                        now.getMinutes().toString().padStart(2, '0') + 
                        now.getSeconds().toString().padStart(2, '0');
      const dbName = `nb_${timestamp}_${id}`;
      
      const rootConn = await mysql.createConnection({
          host: process.env.MYSQL_IP || '127.0.0.1',
          port: parseInt(process.env.MYSQL_PORT || '3306'),
          user: process.env.MYSQL_USER || 'root',
          password: process.env.MYSQL_PASSWORD || ''
      });
      await rootConn.query(`CREATE DATABASE \`${dbName}\``);
      await rootConn.end();

      const icons = [
        'Database', 'Zap', 'Brain', 'BarChart3', 'Layers', 'Boxes', 'Cpu', 'Activity',
        'LineChart', 'PieChart', 'Table', 'FileText', 'Globe', 'Server', 'Cloud', 'Code2',
        'Terminal', 'ShieldCheck', 'Search', 'Filter', 'FolderGit2'
      ];
      const randomIcon = icons[Math.floor(Math.random() * icons.length)];

      const sysPool = await getPool(SYSTEM_DB);
      await sysPool.query(
        `INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, views) VALUES (?, ?, ?, ?, ?, 0)`,
        [id, dbName, '未命名主题', 0, randomIcon]
      );

      res.json({ id, db_name: dbName, topic: '未命名主题', icon_name: randomIcon, views: 0 });
    } catch (err) {
      if (IS_DEBUG) console.error("[Lobby POST Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // CLONE Notebook Logic
  app.post('/notebooks/clone', async (req, res) => {
      const { source_db_name, new_topic, suggestions_json } = req.body;
      
      try {
          const id = crypto.randomBytes(4).toString('hex');
          const now = new Date();
          const timestamp = now.getFullYear().toString() + 
                            (now.getMonth() + 1).toString().padStart(2, '0') + 
                            now.getDate().toString().padStart(2, '0') + 
                            now.getHours().toString().padStart(2, '0') + 
                            now.getMinutes().toString().padStart(2, '0') + 
                            now.getSeconds().toString().padStart(2, '0');
          const newDbName = `nb_${timestamp}_${id}`;

          const rootConn = await mysql.createConnection({
              host: process.env.MYSQL_IP || '127.0.0.1',
              port: parseInt(process.env.MYSQL_PORT || '3306'),
              user: process.env.MYSQL_USER || 'root',
              password: process.env.MYSQL_PASSWORD || ''
          });

          // 1. Create New Database
          await rootConn.query(`CREATE DATABASE \`${newDbName}\``);

          // 2. Clone Tables (Structure and Data)
          // Get list of tables from source
          const [tables] = await rootConn.query(`
              SELECT TABLE_NAME 
              FROM information_schema.TABLES 
              WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
          `, [source_db_name]);

          for (const row of tables) {
              const tableName = row.TABLE_NAME;
              // Create table like source
              await rootConn.query(`CREATE TABLE \`${newDbName}\`.\`${tableName}\` LIKE \`${source_db_name}\`.\`${tableName}\``);
              // Insert data
              await rootConn.query(`INSERT INTO \`${newDbName}\`.\`${tableName}\` SELECT * FROM \`${source_db_name}\`.\`${tableName}\``);
          }
          
          await rootConn.end();

          // 3. Register Notebook
          const sysPool = await getPool(SYSTEM_DB);
          const iconName = 'Copy'; // Clone icon
          await sysPool.query(
              `INSERT INTO \`${NOTEBOOK_LIST_TABLE}\` (id, db_name, topic, user_id, icon_name, suggestions_json, views) VALUES (?, ?, ?, ?, ?, ?, 0)`,
              [id, newDbName, new_topic || 'Cloned Notebook', 0, iconName, suggestions_json]
          );
          
          // 4. Return new notebook object
          const [newNb] = await sysPool.query(`SELECT * FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
          
          res.json(newNb[0]);

      } catch(err) {
          console.error("[Clone Error]:", err);
          res.status(500).json({ message: "Failed to clone notebook: " + err.message });
      }
  });

  app.patch('/notebooks/:id', async (req, res) => {
    const { id } = req.params;
    const { topic, suggestions_json } = req.body;
    try {
      const sysPool = await getPool(SYSTEM_DB);
      let query = 'UPDATE `' + NOTEBOOK_LIST_TABLE + '` SET ';
      const params = [];
      const updates = [];

      if (topic !== undefined) {
        updates.push('topic = ?');
        params.push(topic);
      }
      if (suggestions_json !== undefined) {
        updates.push('suggestions_json = ?');
        params.push(suggestions_json);
      }

      if (updates.length === 0) return res.json({ success: true });

      query += updates.join(', ') + ' WHERE id = ?';
      params.push(id);

      await sysPool.query(query, params);
      res.json({ success: true });
    } catch (err) {
      if (IS_DEBUG) console.error("[Lobby PATCH Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/notebooks/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const sysPool = await getPool(SYSTEM_DB);
      const [rows] = await sysPool.query(`SELECT db_name FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
      
      // 1. Delete Physical Database
      if (rows.length > 0) {
        const dbToDrop = rows[0].db_name;
        const rootConn = await mysql.createConnection({
          host: process.env.MYSQL_IP || '127.0.0.1',
          port: parseInt(process.env.MYSQL_PORT || '3306'),
          user: process.env.MYSQL_USER || 'root',
          password: process.env.MYSQL_PASSWORD || ''
        });
        await rootConn.query(`DROP DATABASE IF EXISTS \`${dbToDrop}\``);
        await rootConn.end();
        pools.delete(dbToDrop);
      }

      // 2. Cascading Delete: Delete any Apps derived from this Notebook
      await sysPool.query(`DELETE FROM \`${PUBLISHED_APPS_TABLE}\` WHERE source_notebook_id = ?`, [id]);

      // 3. Delete Notebook Entry
      await sysPool.query(`DELETE FROM \`${NOTEBOOK_LIST_TABLE}\` WHERE id = ?`, [id]);
      res.json({ success: true });
    } catch (err) {
      if (IS_DEBUG) console.error("[Lobby DELETE Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
