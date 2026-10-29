import { Schema, model } from 'mongoose';

/** Something bought to make tiramisu (an ingredient or packaging), offered in the purchase form. */
const ingredientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    unit: { type: String, required: true, trim: true, maxlength: 20 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

ingredientSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Ingredient = model('Ingredient', ingredientSchema);
