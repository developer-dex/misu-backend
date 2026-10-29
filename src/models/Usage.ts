import { Schema, model } from 'mongoose';

export const COST_SOURCES = ['average', 'manual'] as const;

/**
 * An amount of an ingredient used on a day to make tiramisu. The price per
 * unit is copied in when it is saved, so later purchases at a new price do
 * not change what past days cost.
 */
const usageSchema = new Schema(
  {
    date: { type: String, required: true, index: true },
    ingredient: { type: Schema.Types.ObjectId, ref: 'Ingredient', required: true, index: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    unitCost: { type: Number, required: true, min: 0 },
    cost: { type: Number, required: true, min: 0 },
    // 'average' = worked out from purchases; 'manual' = typed in
    costSource: { type: String, enum: COST_SOURCES, required: true },
    note: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true },
);

export const Usage = model('Usage', usageSchema);
