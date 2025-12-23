
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
      database,
      multipleStatements: true // 关键：允许一次发送多条 SQL
    });
    
    await connection.ping();
    console.log('[Gateway] 数据库连接成功');
    res.json({ success: true, sessionId: Date.now().toString() });
  } catch (err) {
    console.error('[Gateway] 连接失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 路由 2: 执行 SQL
app.post('/sql', async (req, res) => {
  const { sql } = req.body;
  
  if (!connection) {
    res.status(400).json({ message: '未建立活动连接，请先连接数据库' });
    return;
  }

  console.log(`[Gateway] 执行 SQL: ${sql}`);
  
  try {
    // 处理多条语句的结果
    let [rows, fields] = await connection.query(sql);
    
    // 如果是多条 SQL 执行，mysql2 返回的 rows 和 fields 都是数组的数组
    // 我们只需要最后一条 query 的结果
    let finalRows = rows;
    let finalFields = fields;

    if (fields && Array.isArray(fields[0])) {
      console.log(`[Gateway] 检测到多条 SQL，提取最后一条结果集...`);
      finalRows = rows[rows.length - 1];
      finalFields = fields[fields.length - 1];
    }
    
    // 提取列名
    const columns = finalFields ? finalFields.map(f => f.name) : (Array.isArray(finalRows) && finalRows.length > 0 ? Object.keys(finalRows[0]) : []);
    
    res.json({
      rows: Array.isArray(finalRows) ? finalRows : [finalRows],
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
  console.log(`支持多语句执行 (multipleStatements: true)`);
});
