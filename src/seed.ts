import { Ingredient } from './models/Ingredient.js';
import { Product } from './models/Product.js';

/** Fills in the starting menu and purchase list the first time the app runs on an empty database. */
export async function seedDefaults(): Promise<void> {
  if ((await Product.estimatedDocumentCount()) === 0) {
    await Product.insertMany([
      { name: 'Classic', price: 159, sortOrder: 1 },
      { name: 'Biscoff', price: 179, sortOrder: 2 },
    ]);
    console.log('Added default flavours: Classic, Biscoff');
  }
  if ((await Ingredient.estimatedDocumentCount()) === 0) {
    await Ingredient.insertMany([
      { name: 'Biscoff biscuits', unit: 'pack', sortOrder: 1 },
      { name: 'Coffee', unit: 'g', sortOrder: 2 },
      { name: 'Mascarpone cheese', unit: 'g', sortOrder: 3 },
      { name: 'Whipping cream', unit: 'ml', sortOrder: 4 },
      { name: 'Bowls', unit: 'pcs', sortOrder: 5 },
    ]);
    console.log('Added default purchase items');
  }
}
