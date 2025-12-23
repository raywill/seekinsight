
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
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
      // Set AI_PROVIDER to 'aliyun' or 'gemini'
      'process.env.AI_PROVIDER': JSON.stringify(env.AI_PROVIDER || 'aliyun'),
    },
  };
});
