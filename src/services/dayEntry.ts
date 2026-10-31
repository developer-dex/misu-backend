import { DayLog } from '../models/DayLog.js';
import { Order, PAYMENT_METHODS, type PaymentMethod } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { StallSession } from '../models/StallSession.js';
import { HttpError } from '../utils/http.js';
import { summarise } from './totals.js';

/**
 * A day's sales typed in afterwards (Past days), instead of rung up order by
 * order. It is stored as ordinary data so every report counts it: one order per
 * payment method marked source 'summary', plus a 'summary' session for the
 * opening hours. Saving again replaces those; orders from the Sell screen are
 * never touched.
 */

const SUMMARY = { source: 'summary' } as const;
const LIVE = { source: { $ne: 'summary' } };

type Line = { productId: string; qty: number };
type Sale = { items: Line[]; discount: number };

export type DayEntryInput = {
  opened: Date | null;
  closed: Date | null;
  cash: Sale;
  online: Sale;
  // null leaves the day's "made" counts as they are
  prepared: Line[] | null;
  // The price each flavour sold at that day, when it differs from today's menu
  prices: { productId: string; price: number }[];
};

export async function buildDayEntry(day: string) {
  const [products, orders, session, log, liveOrders, liveSessions] = await Promise.all([
    Product.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
    Order.find({ day, ...SUMMARY }).lean(),
    StallSession.findOne({ day, ...SUMMARY }).lean(),
    DayLog.findOne({ day }).lean(),
    Order.find({ day, ...LIVE }).lean(),
    StallSession.countDocuments({ day, ...LIVE }),
  ]);

  // The price each flavour was entered at, so an old day keeps its price when edited later
  const enteredPrice = new Map<string, number>();
  const sales: Record<PaymentMethod, Sale> = { cash: { items: [], discount: 0 }, online: { items: [], discount: 0 } };
  for (const o of orders) {
    const sale = sales[o.payment as PaymentMethod];
    sale.discount += o.discount;
    for (const i of o.items) {
      const id = String(i.product);
      enteredPrice.set(id, i.unitPrice);
      const line = sale.items.find((l) => l.productId === id);
      if (line) line.qty += i.qty;
      else sale.items.push({ productId: id, qty: i.qty });
    }
  }

  const prepared = (log?.prepared ?? []).map((p) => ({ productId: String(p.product), qty: p.qty }));
  const used = new Set([...enteredPrice.keys(), ...prepared.map((p) => p.productId)]);
  const live = summarise(liveOrders);

  return {
    day,
    exists: orders.length > 0 || session !== null,
    opened: session?.start ?? null,
    closed: session?.end ?? null,
    cash: sales.cash,
    online: sales.online,
    prepared,
    products: products
      .filter((p) => p.active || used.has(String(p._id)))
      .map((p) => ({
        productId: String(p._id),
        name: p.name,
        price: enteredPrice.get(String(p._id)) ?? p.price,
        menuPrice: p.price,
        active: p.active,
      })),
    // What the Sell screen already has for this day; the entry is added on top
    live: { orderCount: live.orderCount, units: live.units, net: live.net, sessionCount: liveSessions },
  };
}

export async function saveDayEntry(day: string, input: DayEntryInput, username: string | null) {
  const lines = (sale: Sale) => sale.items.filter((i) => i.qty > 0);
  const wanted = [...new Set([...lines(input.cash), ...lines(input.online)].map((i) => i.productId))];
  if (wanted.length === 0) throw new HttpError(400, 'Add how many tiramisu you sold');

  const [products, previous] = await Promise.all([
    Product.find({ _id: { $in: [...new Set([...wanted, ...(input.prepared ?? []).map((p) => p.productId)])] } }).lean(),
    Order.find({ day, ...SUMMARY }).lean(),
  ]);
  const byId = new Map(products.map((p) => [String(p._id), p]));
  if (wanted.some((id) => !byId.has(id)) || (input.prepared ?? []).some((p) => !byId.has(p.productId))) {
    throw new HttpError(400, 'Unknown flavour');
  }
  // Price typed for the day, else the price it was saved at before, else today's menu price
  const typedPrice = new Map(input.prices.map((p) => [p.productId, p.price]));
  const enteredPrice = new Map(previous.flatMap((o) => o.items.map((i) => [String(i.product), i.unitPrice] as const)));

  // Work out both orders before writing anything, so a bad discount leaves the day untouched
  const orders = PAYMENT_METHODS.flatMap((payment) => {
    const sale = input[payment];
    const qty = new Map<string, number>();
    for (const i of lines(sale)) qty.set(i.productId, (qty.get(i.productId) ?? 0) + i.qty);
    const items = [...qty].map(([id, n]) => {
      const p = byId.get(id)!;
      return { product: p._id, name: p.name, unitPrice: typedPrice.get(id) ?? enteredPrice.get(id) ?? p.price, qty: n };
    });
    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
    if (sale.discount > subtotal) {
      throw new HttpError(400, `The ${payment} discount is more than the ${payment} sales`);
    }
    if (items.length === 0) return [];
    return [{ payment, items, subtotal, discount: sale.discount, total: Math.round((subtotal - sale.discount) * 100) / 100 }];
  });

  await Promise.all([Order.deleteMany({ day, ...SUMMARY }), StallSession.deleteMany({ day, ...SUMMARY })]);

  const session =
    input.opened && input.closed
      ? await StallSession.create({ day, start: input.opened, end: input.closed, startedBy: username, stoppedBy: username, ...SUMMARY })
      : null;

  await Order.insertMany(
    orders.map((o) => ({ day, ...o, session: session?._id ?? null, note: 'Day total', ...SUMMARY })),
  );

  if (input.prepared) {
    await DayLog.updateOne(
      { day },
      { $set: { prepared: input.prepared.filter((p) => p.qty > 0).map((p) => ({ product: p.productId, qty: p.qty })) } },
      { upsert: true },
    );
  }

  return buildDayEntry(day);
}

export async function clearDayEntry(day: string) {
  await Promise.all([Order.deleteMany({ day, ...SUMMARY }), StallSession.deleteMany({ day, ...SUMMARY })]);
  return buildDayEntry(day);
}
