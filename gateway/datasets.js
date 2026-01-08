
import { DATASETS } from './common.js';
import { dal } from './dal.js';

export default function(app) {
  app.get('/datasets', (req, res) => {
    res.json(DATASETS);
  });

  app.post('/datasets/import', async (req, res) => {
    const { dbName, datasetId } = req.body;
    if (!dbName || !datasetId) return res.status(400).json({ message: "Missing params" });

    try {
      const topicName = await dal.importDataset(dbName, datasetId);
      res.json({ success: true, topicName });
    } catch (err) {
      console.error("[Dataset Import Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
