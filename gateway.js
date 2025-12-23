
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// 存储活动连接
let connection = null;

// 路由 1: 建立真实连接测试
app.post('/connect', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  
  console.log(`[Gateway] 尝试连接到数据库: ${host}:${port}`);
  
  try {
    if (connection) {
      await connection.end().catch(() => {});
    }
    
    connection = await mysql.createConnection({
      host,
      port: parseInt(port),
      user,
      password,
      database
    });
    
    await connection.ping();
    console.log('[Gateway] 数据库连接成功');
    res.json({ success: true, sessionId: Date.now().toString() });
  } catch (err) {
    console.error('[Gateway] 连接失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 路由 2: 执行真实 SQL
app.post('/sql', async (req, res) => {
  const { sql } = req.body;
  
  if (!connection) {
    res.status(400).json({ message: '未建立活动连接，请先连接数据库' });
    return;
  }

  console.log(`[Gateway] 执行 SQL: ${sql}`);
  
  try {
    // 使用 query 而不是 execute。
    // execute 会在服务器端创建 Prepared Statement (Cursor)，在高并发或大量循环调用时容易触发 "maximum open cursors exceeded"。
    // query 直接发送 SQL 文本，更适合此类动态 SQL 场景。
    const [rows, fields] = await connection.query(sql);
    
    // 提取列名
    const columns = fields ? fields.map(f => f.name) : (Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0]) : []);
    
    res.json({
      rows: Array.isArray(rows) ? rows : [rows],
      columns: columns
    });
  } catch (err) {
    console.error('[Gateway] SQL 执行失败:', err.message);
    res.status(500).json({ message: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 SQL Gateway 已以 ESM 模式启动: http://localhost:${PORT}`);
  console.log(`请确保前端请求指向此地址。`);
});
