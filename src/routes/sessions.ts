import { Router } from 'express';
import { z } from 'zod';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { StallSession } from '../models/StallSession.js';
import { orderJson } from '../services/dayView.js';
import { MIN_RATE_MS, ordersBySession, sessionJson } from '../services/sessions.js';
import { summarise } from '../services/totals.js';
import { HttpError, dayString, idParam, parse } from '../utils/http.js';

export const sessionsRouter = Router();

/** Numbers each session within its day, in start order: 1st, 2nd… */
function numberByDay(sessions: { _id: unknown; day: string; start: Date }[]): Map<string, number> {
  const counts = new Map<string, number>();
  const numbers = new Map<string, number>();
  for (const s of [...sessions].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const n = (counts.get(s.day) ?? 0) + 1;
    counts.set(s.day, n);
    numbers.set(String(s._id), n);
  }
  return numbers;
}

/**
 * The session log between two dates: every clock run with what was sold in it,
 * newest first, plus per-day sales made while the clock was stopped.
 */
sessionsRouter.get('/', async (req, res) => {
  const { from, to } = parse(z.object({ from: dayString, to: dayString }), req.query);
  if (from > to) throw new HttpError(400, 'Start date is after end date');

  const [products, sessions, orders] = await Promise.all([
    Product.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
    StallSession.find({ day: { $gte: from, $lte: to } }).lean(),
    Order.find({ day: { $gte: from, $lte: to } }).lean(),
  ]);

  const bySession = ordersBySession(orders);
  const numbers = numberByDay(sessions);
  const list = sessions
    .map((s) => sessionJson(s, bySession.get(String(s._id)) ?? [], numbers.get(String(s._id))!))
    .sort((a, b) => b.start.getTime() - a.start.getTime());

  const outsideByDay = new Map<string, typeof orders>();
  for (const o of bySession.get('') ?? []) outsideByDay.set(o.day, [...(outsideByDay.get(o.day) ?? []), o]);
  const outside = [...outsideByDay.entries()].map(([day, dayOrders]) => {
    const t = summarise(dayOrders);
    return { day, orderCount: t.orderCount, units: t.units, net: t.net };
  });

  const inSessions = summarise(orders.filter((o) => o.session));
  const durationMs = list.reduce((sum, s) => sum + s.durationMs, 0);

  res.json({
    from,
    to,
    products: products
      .filter((p) => p.active || inSessions.unitsByProduct.has(String(p._id)))
      .map((p) => ({ productId: String(p._id), name: p.name })),
    totals: {
      sessionCount: list.length,
      durationMs,
      orderCount: inSessions.orderCount,
      units: inSessions.units,
      net: inSessions.net,
      cash: inSessions.cash,
      online: inSessions.online,
      unitsPerHour: durationMs >= MIN_RATE_MS ? inSessions.units / (durationMs / 3_600_000) : null,
    },
    sessions: list,
    outside,
  });
});

/** One session with each order sold during it. */
sessionsRouter.get('/:id', async (req, res) => {
  const session = await StallSession.findById(idParam(req)).lean();
  if (!session) throw new HttpError(404, 'Session not found');
  const [orders, sameDay] = await Promise.all([
    Order.find({ session: session._id }).sort({ createdAt: -1 }).lean(),
    StallSession.find({ day: session.day }, { day: 1, start: 1 }).lean(),
  ]);
  const number = numberByDay(sameDay).get(String(session._id)) ?? 1;
  res.json({ session: sessionJson(session, orders, number), orders: orders.map(orderJson) });
});

/**
 * Removes a session started by mistake. Its orders are kept; they just no
 * longer belong to a session.
 */
sessionsRouter.delete('/:id', async (req, res) => {
  const session = await StallSession.findByIdAndDelete(idParam(req));
  if (!session) throw new HttpError(404, 'Session not found');
  await Order.updateMany({ session: session._id }, { $set: { session: null } });
  res.status(204).end();
});
