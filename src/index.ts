import mongoose from 'mongoose';
import { authEnabled, config } from './config.js';
import app from './app.js';
import { connectDb } from './db.js';

async function main() {
  await connectDb();

  const server = app.listen(config.port, () => {
    console.log(`MISU API listening on http://localhost:${config.port}`);
    if (!authEnabled) console.warn('APP_PASSCODE is not set: anyone who can reach this server can use the app.');
  });

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Could not start the server:', err instanceof Error ? err.message : err);
  process.exit(1);
});
