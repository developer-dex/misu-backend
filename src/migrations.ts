import { DayLog } from './models/DayLog.js';
import { Order } from './models/Order.js';
import { StallSession } from './models/StallSession.js';

interface LegacyShift {
  start: Date;
  end?: Date | null;
}

/**
 * Clock runs used to be stored inside each day as `shifts`. Moves them into the
 * session log and links the orders made during each one. Safe to run every start.
 */
export async function migrateShiftsToSessions(): Promise<void> {
  // The raw collection, because `shifts` is no longer in the schema
  const logs = await DayLog.collection.find({ 'shifts.0': { $exists: true } }).toArray();
  for (const log of logs) {
    const shifts = log.shifts as LegacyShift[];
    const sessions = await StallSession.insertMany(
      shifts.map((s) => ({ day: log.day as string, start: s.start, end: s.end ?? null })),
    );
    for (const s of sessions) {
      const createdAt = s.end ? { $gte: s.start, $lte: s.end } : { $gte: s.start };
      await Order.updateMany({ day: s.day, session: null, createdAt }, { $set: { session: s._id } });
    }
    await DayLog.collection.updateOne({ _id: log._id }, { $unset: { shifts: '' } });
    console.log(`Moved ${sessions.length} clock run(s) on ${log.day} into the session log`);
  }
  await DayLog.collection.dropIndex('shifts.end_1').catch(() => {});
}
