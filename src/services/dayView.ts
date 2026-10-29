import { DayLog } from '../models/DayLog.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { StallSession } from '../models/StallSession.js';
import { ordersBySession, sessionJson, totalMs } from './sessions.js';
import { summarise } from './totals.js';

export function orderJson(o: {
  _id: unknown;
  createdAt?: Date;
  items: { product: unknown; name: string; unitPrice: number; qty: number }[];
  subtotal: number;
  discount: number;
  total: number;
  payment: string;
  note?: string | null;
  session?: unknown;
}) {
  return {
    id: String(o._id),
    createdAt: o.createdAt,
    items: o.items.map((i) => ({ productId: String(i.product), name: i.name, unitPrice: i.unitPrice, qty: i.qty })),
    subtotal: o.subtotal,
    discount: o.discount,
    total: o.total,
    payment: o.payment,
    note: o.note ?? '',
    sessionId: o.session ? String(o.session) : null,
  };
}

/** Everything the Sell screen needs for one day. */
export async function buildDayView(day: string) {
  const [products, log, orders, sessions] = await Promise.all([
    Product.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
    DayLog.findOne({ day }).lean(),
    Order.find({ day }).sort({ createdAt: -1 }).lean(),
    StallSession.find({ day }).sort({ start: 1 }).lean(),
  ]);

  const prepared = new Map((log?.prepared ?? []).map((p) => [String(p.product), p.qty]));
  const totals = summarise(orders);
  const bySession = ordersBySession(orders);
  const sessionList = sessions.map((s, i) => sessionJson(s, bySession.get(String(s._id)) ?? [], i + 1));

  const byProduct = products
    .filter((p) => p.active || totals.unitsByProduct.has(String(p._id)) || prepared.has(String(p._id)))
    .map((p) => {
      const id = String(p._id);
      return {
        productId: id,
        name: p.name,
        sold: totals.unitsByProduct.get(id) ?? 0,
        prepared: prepared.has(id) ? prepared.get(id)! : null,
      };
    });

  return {
    day,
    serverTime: new Date().toISOString(),
    sessions: sessionList,
    currentSession: sessionList.find((s) => s.running) ?? null,
    running: sessionList.some((s) => s.running),
    workedMs: totalMs(sessions),
    byProduct,
    summary: {
      orderCount: totals.orderCount,
      units: totals.units,
      gross: totals.gross,
      discount: totals.discount,
      net: totals.net,
      cash: totals.cash,
      online: totals.online,
    },
    orders: orders.map(orderJson),
  };
}
