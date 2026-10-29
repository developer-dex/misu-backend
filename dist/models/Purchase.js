import { Schema, model } from 'mongoose';
/** Money spent on ingredients or packaging. */
const purchaseSchema = new Schema({
    date: { type: String, required: true, index: true },
    item: { type: String, required: true, trim: true, maxlength: 60 },
    quantity: { type: Number, min: 0, default: null },
    unit: { type: String, trim: true, maxlength: 20, default: '' },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 200, default: '' },
}, { timestamps: true });
export const Purchase = model('Purchase', purchaseSchema);
//# sourceMappingURL=Purchase.js.map