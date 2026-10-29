import mongoose from 'mongoose';
import { config } from './config.js';
import { seedDefaults } from './seed.js';

let connecting: Promise<void> | null = null;

/**
 * Connects once and seeds an empty database. Safe to call on every request:
 * on a serverless host each warm instance reuses the same connection.
 */
export function connectDb(): Promise<void> {
  if (!connecting) {
    mongoose.set('strictQuery', true);
    connecting = mongoose
      .connect(config.mongoUri, { serverSelectionTimeoutMS: 10_000 })
      .then(() => seedDefaults())
      .catch((err) => {
        // Let the next request try again instead of failing forever
        connecting = null;
        throw err;
      });
  }
  return connecting;
}
