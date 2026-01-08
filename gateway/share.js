
import crypto from 'crypto';
import { dal } from './dal.js';

export default function(app) {
  app.post('/shares', async (req, res) => {
    try {
      const { appId, params } = req.body;
      if (!appId) return res.status(400).json({ message: 'App ID required' });
      
      const id = crypto.randomBytes(4).toString('hex').substring(0, 8); 
      await dal.createSnapshot(id, appId, params);
      
      res.json({ success: true, id });
    } catch (err) {
      console.error("[Shares POST Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/shares/:id', async (req, res) => {
    try {
      const params = await dal.getSnapshot(req.params.id);
      if (!params) return res.status(404).json({ message: 'Snapshot not found' });
      res.json(params);
    } catch (err) {
      console.error("[Shares GET Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
