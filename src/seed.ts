import { Ingredient } from './models/Ingredient.js';
import { Product } from './models/Product.js';
import { User } from './models/User.js';
import { hashPassword } from './utils/password.js';

/**
 * Creates the login account, or sets a new password on it if it already exists.
 * A new password logs out every device that was signed in with the old one.
 */
export async function seedUser(username: string, password: string): Promise<'created' | 'updated'> {
  const name = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(name)) throw new Error('Username must be 3-40 letters, numbers, dots, dashes or underscores');
  if (password.length < 8) throw new Error('Password must be at least 8 characters');

  const passwordHash = await hashPassword(password);
  const existing = await User.findOne({ username: name });
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.tokenVersion += 1;
    await existing.save();
    return 'updated';
  }
  await User.create({ username: name, passwordHash });
  return 'created';
}

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
