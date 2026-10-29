/**
 * Small unit handling so a purchase in kg can be costed against usage in g.
 * Each unit maps to a base unit and how many base units it holds.
 */
const UNITS: Record<string, { base: string; factor: number }> = {
  g: { base: 'g', factor: 1 },
  gm: { base: 'g', factor: 1 },
  gms: { base: 'g', factor: 1 },
  gram: { base: 'g', factor: 1 },
  grams: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  kgs: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  ltr: { base: 'ml', factor: 1000 },
  litre: { base: 'ml', factor: 1000 },
  liter: { base: 'ml', factor: 1000 },
  pc: { base: 'pcs', factor: 1 },
  pcs: { base: 'pcs', factor: 1 },
  piece: { base: 'pcs', factor: 1 },
  pieces: { base: 'pcs', factor: 1 },
  pack: { base: 'pack', factor: 1 },
  packs: { base: 'pack', factor: 1 },
  packet: { base: 'pack', factor: 1 },
  packets: { base: 'pack', factor: 1 },
};

function lookup(unit: string) {
  const key = unit.trim().toLowerCase();
  return UNITS[key] ?? { base: key, factor: 1 };
}

/** `qty` in `from` expressed in `to` (500 g → 0.5 kg), or null when the two cannot be compared. */
export function convert(qty: number, from: string, to: string): number | null {
  const a = lookup(from || to);
  const b = lookup(to);
  if (a.base !== b.base) return null;
  return (qty * a.factor) / b.factor;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
