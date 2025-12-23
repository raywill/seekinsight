
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
      multipleStatements: true // 允许一次发送多条 SQL
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
    // 执行查询
    let [rows, fields] = await connection.query(sql);
    
    let finalRows = rows;
    let finalFields = fields;

    /**
     * 鲁棒的多语句检测逻辑:
     * 在 mysql2/promise 中：
     * - 单语句：fields 是一个包含 FieldPacket 的数组。fields[0] 是一个对象。
     * - 多语句：fields 是一个数组的数组。其中每个元素要么是 FieldPacket 数组（SELECT），要么是 undefined（SET/INSERT/UPDATE）。
     */
    const isMultiStatement = Array.isArray(fields) && fields.length > 0 && 
                             (Array.isArray(fields[0]) || fields[0] === undefined);

    if (isMultiStatement) {
      console.log(`[Gateway] 检测到多条 SQL 结果，提取最后一条结果集...`);
      finalRows = rows[rows.length - 1];
      finalFields = fields[fields.length - 1];
    }
    
    // 提取列名
    // 如果 finalFields 存在，说明最后一条是 SELECT 语句，从字段元数据提取
    // 如果不存在，说明最后一条是 DDL/DML，尝试从 finalRows 提取（如果是数组）
    const columns = finalFields 
      ? finalFields.map(f => f.name) 
      : (Array.isArray(finalRows) && finalRows.length > 0 ? Object.keys(finalRows[0]) : []);
    
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
  console.log(`🚀 SQL Gateway 已启动: http://localhost:${PORT}`);
  console.log(`支持多语句混合执行 (e.g., SET + SELECT)`);
});
