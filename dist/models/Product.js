import { Schema, model } from 'mongoose';
/** A tiramisu flavour sold at the stall. */
const productSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 60 },
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });
productSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
export const Product = model('Product', productSchema);
//# sourceMappingURL=Product.js.map