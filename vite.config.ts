
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.MYSQL_IP': JSON.stringify(env.MYSQL_IP),
      'process.env.MYSQL_PORT': JSON.stringify(env.MYSQL_PORT),
      'process.env.MYSQL_USER': JSON.stringify(env.MYSQL_USER),
      'process.env.MYSQL_DB': JSON.stringify(env.MYSQL_DB),
      'process.env.MYSQL_PASSWORD': JSON.stringify(env.MYSQL_PASSWORD),
      'process.env.PG_HOST': JSON.stringify(env.PG_HOST),
      'process.env.PG_PORT': JSON.stringify(env.PG_PORT),
      'process.env.PG_USER': JSON.stringify(env.PG_USER),
      'process.env.PG_DB': JSON.stringify(env.PG_DB),
      'process.env.PG_PASSWORD': JSON.stringify(env.PG_PASSWORD),
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY || env.ALIYUN_API_KEY),
      'process.env.API_BASEURL': JSON.stringify(env.API_BASEURL),
      'process.env.GATEWAY_URL': JSON.stringify(env.GATEWAY_URL || 'http://localhost:3001'),
      'process.env.AI_PROVIDER': JSON.stringify(env.AI_PROVIDER || 'aliyun'),
      'process.env.AI_MODEL_NAME': JSON.stringify(env.AI_MODEL_NAME),
      'process.env.SI_DEBUG_MODE': JSON.stringify(env.SI_DEBUG_MODE !== 'false'),
      'process.env.SQL_AUTO_COMPLETE': JSON.stringify(env.SQL_AUTO_COMPLETE === 'false' ? 'false' : 'true'),
      'process.env.DB_TYPE': JSON.stringify(env.DB_TYPE || 'mysql'), // Inject DB Type
    },
  };
});
