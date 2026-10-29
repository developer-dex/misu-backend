import { Schema, model } from 'mongoose';
/**
 * A stall day: when the shift clock ran and how many of each flavour were made.
 * A day can hold several shifts (stop for a break, start again).
 */
const shiftSchema = new Schema({
    start: { type: Date, required: true },
    end: { type: Date, default: null },
}, { _id: false });
const preparedSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, required: true, min: 0 },
}, { _id: false });
const dayLogSchema = new Schema({
    day: { type: String, required: true, unique: true },
    shifts: { type: [shiftSchema], default: [] },
    prepared: { type: [preparedSchema], default: [] },
}, { timestamps: true });
dayLogSchema.index({ 'shifts.end': 1 });
export const DayLog = model('DayLog', dayLogSchema);
//# sourceMappingURL=DayLog.js.map