
import { DATASETS, MASTER_DB } from './common.js';
import { getPool } from './database.js';

export default function(app) {
  // --- Datasets API ---
  app.get('/datasets', (req, res) => {
    res.json(DATASETS);
  });

  app.post('/datasets/import', async (req, res) => {
    const { dbName, datasetId } = req.body;
    if (!dbName || !datasetId) return res.status(400).json({ message: "Missing params" });

    const dataset = DATASETS.find(d => d.id === datasetId);
    if (!dataset) return res.status(404).json({ message: "Dataset not found" });

    try {
      const userPool = await getPool(dbName);
      const masterPool = await getPool(MASTER_DB);

      // Dynamic Table Discovery: Find all tables matching the dataset prefix
      const [sourceTables] = await masterPool.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE ?`,
        [MASTER_DB, `${dataset.prefix}_%`]
      );

      if (sourceTables.length === 0) {
          return res.status(404).json({ message: "No tables found in master dataset for this prefix." });
      }

      // Clone discovered tables from Master DB to User DB
      for (const row of sourceTables) {
        const sourceTable = row.TABLE_NAME;
        // Derive target table name by removing the prefix and underscore (e.g. 'retail_orders' -> 'orders')
        // Ensure we only replace the prefix at the start
        const targetTable = sourceTable.substring(dataset.prefix.length + 1);

        if (!targetTable) continue;

        // Check if table exists in target
        const [exists] = await userPool.query(`SHOW TABLES LIKE ?`, [targetTable]);
        if (exists.length > 0) {
          await userPool.query(`DROP TABLE \`${targetTable}\``);
        }
        
        // CREATE LIKE
        await userPool.query(`CREATE TABLE \`${targetTable}\` LIKE \`${MASTER_DB}\`.\`${sourceTable}\``);
        
        // INSERT SELECT
        await userPool.query(`INSERT INTO \`${targetTable}\` SELECT * FROM \`${MASTER_DB}\`.\`${sourceTable}\``);
      }

      res.json({ success: true, topicName: dataset.topicName });
    } catch (err) {
      console.error("[Dataset Import Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
