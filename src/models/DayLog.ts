import { Schema, model } from 'mongoose';

/** A stall day: how many of each flavour were made. Clock runs are in StallSession. */
const preparedSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const dayLogSchema = new Schema(
  {
    day: { type: String, required: true, unique: true },
    prepared: { type: [preparedSchema], default: [] },
    // The stall stayed closed this day
    off: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const DayLog = model('DayLog', dayLogSchema);

/** Selling or opening on a day marked off means it was not off after all. */
export async function clearDayOff(day: string): Promise<void> {
  await DayLog.updateOne({ day, off: true }, { $set: { off: false } });
}
