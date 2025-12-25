
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Fix: Cast process to any to access cwd() when Node.js types are not fully recognized by the compiler
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
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY || env.ALIYUN_API_KEY),
      'process.env.API_BASEURL': JSON.stringify(env.API_BASEURL),
      'process.env.GATEWAY_URL': JSON.stringify(env.GATEWAY_URL || 'http://localhost:3001'),
      'process.env.AI_PROVIDER': JSON.stringify(env.AI_PROVIDER || 'aliyun'),
      'process.env.SI_DEBUG_MODE': JSON.stringify(env.SI_DEBUG_MODE !== 'false'),
      // Fix: Ensure SQL_AUTO_COMPLETE is defined as a string 'true' or 'false' for reliable environment variable behavior
      'process.env.SQL_AUTO_COMPLETE': JSON.stringify(env.SQL_AUTO_COMPLETE === 'false' ? 'false' : 'true'),
    },
  };
});
