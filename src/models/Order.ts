import { Schema, model } from 'mongoose';

export const PAYMENT_METHODS = ['cash', 'online'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// 'live' = rung up on the Sell screen; 'summary' = a day's totals entered afterwards on Past days
export const ENTRY_SOURCES = ['live', 'summary'] as const;

/**
 * One sale at the stall. An order with no payment yet is on hold: the customer
 * ordered and will pay when they collect it, so it is not counted as takings
 * until then. Name and price are copied from the product when the
 * order is made, so changing a price later does not rewrite past sales.
 */
const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    day: { type: String, required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    // null while on hold
    payment: { type: String, enum: PAYMENT_METHODS, default: null },
    // Who an on-hold order is for; kept after it is paid
    customer: {
      type: new Schema({ name: { type: String, trim: true, maxlength: 60 }, phone: { type: String, trim: true, maxlength: 20, default: '' } }, { _id: false }),
      default: null,
    },
    paidAt: { type: Date, default: null },
    note: { type: String, trim: true, maxlength: 200 },
    // The clock session running when the sale was made; null when the clock was stopped
    session: { type: Schema.Types.ObjectId, ref: 'StallSession', default: null, index: true },
    source: { type: String, enum: ENTRY_SOURCES, default: 'live' },
    // Made by the app for each new order, so a save retried after a dropped
    // connection finds the first copy instead of recording the sale twice
    clientId: { type: String },
  },
  { timestamps: true },
);

orderSchema.index({ payment: 1 });
orderSchema.index({ clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } });

export const Order = model('Order', orderSchema);

/** Orders still waiting to be paid for. */
export const ON_HOLD = { payment: null } as const;
