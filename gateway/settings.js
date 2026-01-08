
import { dal } from './dal.js';

export default function(app) {
  app.get('/settings/:userId', async (req, res) => {
    try {
      const settings = await dal.getSettings(req.params.userId);
      res.json(settings);
    } catch (err) {
      console.error("[Settings GET Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/settings/:userId', async (req, res) => {
    try {
      await dal.updateSettings(req.params.userId, req.body);
      res.json({ success: true });
    } catch (err) {
      console.error("[Settings PUT Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
