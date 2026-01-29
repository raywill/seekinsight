
import { dal } from './dal.js';
import { IS_DEBUG } from './common.js';

export default function(app) {
  app.post('/sql', async (req, res) => {
    const { sql, dbName } = req.body;
    if (!dbName) return res.status(400).json({ message: 'Missing dbName' });
    try {
      const result = await dal.executeUserQuery(dbName, sql);
      res.json(result);
    } catch (err) {
      if (IS_DEBUG) {
        console.error(`[SQL Error in ${dbName}]:`, err.message);
        console.error(`Query: ${sql}`);
      }
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/databases', async (req, res) => {
    try {
      const dbs = await dal.getDatabases();
      res.json(dbs);
    } catch (err) {
      if (IS_DEBUG) console.error("[Databases GET Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
