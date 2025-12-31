
import express from 'express';
import cors from 'cors';
import { PORT } from './gateway/common.js';
import { initSystem } from './gateway/database.js';

import datasetsRoutes from './gateway/datasets.js';
import shareRoutes from './gateway/share.js';
import appsRoutes from './gateway/apps.js';
import notebooksRoutes from './gateway/notebooks.js';
import sqlRoutes from './gateway/sql.js';
import pythonRoutes from './gateway/python.js';
import logPromptRoutes from './gateway/log_prompt.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for snapshots

// Register Routes
datasetsRoutes(app);
shareRoutes(app);
appsRoutes(app);
notebooksRoutes(app);
sqlRoutes(app);
pythonRoutes(app);
logPromptRoutes(app);

initSystem().then(() => {
  app.listen(PORT, () => console.log(`🚀 Gateway running at http://localhost:${PORT}`));
});
