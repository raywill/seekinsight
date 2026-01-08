
import crypto from 'crypto';
import { dal } from './dal.js';
import { IS_DEBUG } from './common.js';

export default function(app) {
  app.get('/notebooks', async (req, res) => {
    try {
      const rows = await dal.getNotebooks();
      res.json(rows);
    } catch (err) {
      if (IS_DEBUG) console.error("[Lobby GET Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/notebooks/:id/view', async (req, res) => {
    try {
      await dal.incrementNotebookView(req.params.id);
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
      
      const icons = [
        'Database', 'Zap', 'Brain', 'BarChart3', 'Layers', 'Boxes', 'Cpu', 'Activity',
        'LineChart', 'PieChart', 'Table', 'FileText', 'Globe', 'Server', 'Cloud', 'Code2',
        'Terminal', 'ShieldCheck', 'Search', 'Filter', 'FolderGit2'
      ];
      const randomIcon = icons[Math.floor(Math.random() * icons.length)];

      await dal.createNotebook(id, dbName, '未命名主题', randomIcon);

      res.json({ id, db_name: dbName, topic: '未命名主题', icon_name: randomIcon, views: 0 });
    } catch (err) {
      if (IS_DEBUG) console.error("[Lobby POST Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

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

          const newNb = await dal.cloneNotebook(newDbName, source_db_name, id, new_topic || 'Cloned Notebook', 'Copy', suggestions_json);
          res.json(newNb);
      } catch(err) {
          console.error("[Clone Error]:", err);
          res.status(500).json({ message: "Failed to clone notebook: " + err.message });
      }
  });

  app.patch('/notebooks/:id', async (req, res) => {
    try {
      await dal.updateNotebook(req.params.id, req.body.topic, req.body.suggestions_json);
      res.json({ success: true });
    } catch (err) {
      if (IS_DEBUG) console.error("[Lobby PATCH Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/notebooks/:id', async (req, res) => {
    try {
      await dal.deleteNotebook(req.params.id);
      res.json({ success: true });
    } catch (err) {
      if (IS_DEBUG) console.error("[Lobby DELETE Error]:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
