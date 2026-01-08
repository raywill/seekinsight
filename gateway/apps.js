
import crypto from 'crypto';
import { dal } from './dal.js';

export default function(app) {
  app.get('/apps', async (req, res) => {
    try {
      const rows = await dal.getApps();
      res.json(rows);
    } catch (err) {
      console.error("[Apps GET Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/apps/:id', async (req, res) => {
    try {
      const row = await dal.getApp(req.params.id);
      if (!row) return res.status(404).json({ message: 'App not found' });
      res.json(row);
    } catch (err) {
      console.error("[Apps GET Single Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/apps/:id/view', async (req, res) => {
    try {
      await dal.incrementAppView(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("[Apps View Increment Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/apps', async (req, res) => {
    try {
      const id = crypto.randomBytes(4).toString('hex');
      await dal.createApp({ id, ...req.body, author: req.body.author || 'User' });
      res.json({ success: true, id });
    } catch (err) {
      console.error("[Apps POST Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/apps/:id', async (req, res) => {
    try {
      const success = await dal.updateApp(req.params.id, { ...req.body, author: req.body.author || 'User' });
      if (!success) return res.status(404).json({ message: 'App not found' });
      res.json({ success: true, id: req.params.id });
    } catch (err) {
      console.error("[Apps PUT Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/apps/:id', async (req, res) => {
    try {
      await dal.deleteApp(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("[Apps DELETE Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
