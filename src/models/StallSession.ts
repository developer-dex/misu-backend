import { Schema, model } from 'mongoose';
import { ENTRY_SOURCES } from './Order.js';

/**
 * One run of the stall clock, from Start to Stop. A day can have several
 * (stop for a break, start again). Orders made while it runs point to it.
 */
const stallSessionSchema = new Schema(
  {
    day: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date, default: null },
    startedBy: { type: String, default: null },
    stoppedBy: { type: String, default: null },
    // 'summary' = opening hours typed in on Past days rather than timed with the clock
    source: { type: String, enum: ENTRY_SOURCES, default: 'live' },
  },
  { timestamps: true },
);

stallSessionSchema.index({ day: 1, start: 1 });
stallSessionSchema.index({ end: 1 });

export const StallSession = model('StallSession', stallSessionSchema);
