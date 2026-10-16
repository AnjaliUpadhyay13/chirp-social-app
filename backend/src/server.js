import app from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';

await connectDB();

const server = app.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${env.PORT} is already in use.`);
    console.error('PowerShell fix:');
    console.error(`  netstat -ano | findstr :${env.PORT}`);
    console.error('  taskkill /PID <PID> /F');
    console.error('Or change PORT in backend/.env\n');
  } else {
    console.error(err);
  }
  process.exit(1);
});

const shutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down...`);
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
