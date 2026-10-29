/**
 * Seeder: the default flavours and purchase list (only into an empty database)
 * and the login account.
 *
 *   npm run seed                                  # account from SEED_USERNAME / SEED_PASSWORD in .env
 *   npm run seed -- --username ravi --password …  # or pass them directly
 *
 * Running it again for an existing username sets that user's password.
 */
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { seedDefaults, seedUser } from '../seed.js';

async function main() {
  const { values } = parseArgs({
    options: { username: { type: 'string' }, password: { type: 'string' } },
  });
  const username = values.username ?? process.env.SEED_USERNAME ?? '';
  const password = values.password ?? process.env.SEED_PASSWORD ?? '';

  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10_000 });
  try {
    await seedDefaults();
    if (!username || !password) {
      console.log('No account seeded: set SEED_USERNAME and SEED_PASSWORD in .env, or pass --username and --password.');
      return;
    }
    const result = await seedUser(username, password);
    console.log(result === 'created' ? `Created login "${username.trim().toLowerCase()}"` : `Updated the password for "${username.trim().toLowerCase()}"`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Seeding failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
