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
  },
  { timestamps: true },
);

export const DayLog = model('DayLog', dayLogSchema);
