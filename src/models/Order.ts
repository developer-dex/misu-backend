import { Schema, model } from 'mongoose';

export const PAYMENT_METHODS = ['cash', 'online'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * One sale at the stall. Name and price are copied from the product when the
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
    payment: { type: String, enum: PAYMENT_METHODS, required: true },
    note: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true },
);

export const Order = model('Order', orderSchema);
