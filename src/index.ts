import mongoose from 'mongoose';
import { config } from './config.js';
import { createApp } from './app.js';
import { migrateShiftsToSessions } from './migrations.js';
import { User } from './models/User.js';
import { seedDefaults } from './seed.js';

async function main() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10_000 });
  await migrateShiftsToSessions();
  await seedDefaults();

  const users = await User.countDocuments();

  const server = createApp().listen(config.port, () => {
    console.log(`MISU API listening on http://localhost:${config.port}`);
    if (users === 0) console.warn('No login account yet. Run `npm run seed` to create one.');
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
