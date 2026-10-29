import { Ingredient } from '../models/Ingredient.js';
import { Purchase } from '../models/Purchase.js';
import { Usage } from '../models/Usage.js';
import { convert, round2 } from '../utils/units.js';

type PurchaseDoc = { item: string; quantity?: number | null; unit?: string | null; amount: number };

/**
 * What has been bought of one item, in its own unit. Purchases are matched by
 * name (ignoring case); only those with a quantity in a comparable unit count
 * towards the average price.
 */
function boughtOf(name: string, unit: string, purchases: PurchaseDoc[]) {
  let qty = 0;
  let amount = 0;
  let unpriced = 0; // purchases that could not be counted (no quantity, or e.g. "pack" against "g")
  for (const p of purchases) {
    if (p.item.trim().toLowerCase() !== name.trim().toLowerCase()) continue;
    const q = p.quantity ? convert(p.quantity, p.unit ?? '', unit) : null;
    if (q === null || q <= 0) {
      unpriced += 1;
      continue;
    }
    qty += q;
    amount += p.amount;
  }
  return { qty, amount, unpriced, unitCost: qty > 0 ? amount / qty : null };
}

/** Average price per unit of an ingredient across every purchase of it, or null if none has a quantity. */
export async function averageUnitCost(ingredient: { name: string; unit: string }): Promise<number | null> {
  const purchases = await Purchase.find({ item: ingredient.name }).collation({ locale: 'en', strength: 2 }).lean();
  return boughtOf(ingredient.name, ingredient.unit, purchases).unitCost;
}

/** Bought, used and left for every item on the purchase list. */
export async function stockSummary() {
  const [ingredients, purchases, usage] = await Promise.all([
    Ingredient.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
    Purchase.find({}, { item: 1, quantity: 1, unit: 1, amount: 1 }).lean(),
    Usage.find({}, { ingredient: 1, quantity: 1, unit: 1, cost: 1, date: 1 }).lean(),
  ]);

  return ingredients.map((ing) => {
    const bought = boughtOf(ing.name, ing.unit, purchases);
    let usedQty = 0;
    let usedCost = 0;
    let lastUsed: string | null = null;
    for (const u of usage) {
      if (String(u.ingredient) !== String(ing._id)) continue;
      usedQty += convert(u.quantity, u.unit, ing.unit) ?? 0;
      usedCost += u.cost;
      if (!lastUsed || u.date > lastUsed) lastUsed = u.date;
    }
    const leftQty = bought.qty - usedQty;
    return {
      ingredientId: String(ing._id),
      name: ing.name,
      unit: ing.unit,
      boughtQty: round2(bought.qty),
      boughtAmount: round2(bought.amount),
      unpricedPurchases: bought.unpriced,
      unitCost: bought.unitCost,
      usedQty: round2(usedQty),
      usedCost: round2(usedCost),
      leftQty: round2(leftQty),
      leftValue: bought.unitCost !== null && leftQty > 0 ? round2(leftQty * bought.unitCost) : 0,
      lastUsed,
    };
  });
}
