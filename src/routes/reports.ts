import { Router } from 'express';
import { z } from 'zod';
import { DayLog } from '../models/DayLog.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Purchase } from '../models/Purchase.js';
import { StallSession } from '../models/StallSession.js';
import { Usage } from '../models/Usage.js';
import { MIN_RATE_MS, totalMs } from '../services/sessions.js';
import { summarise } from '../services/totals.js';
import { eachDay } from '../utils/dates.js';
import { HttpError, dayString, parse } from '../utils/http.js';

export const reportsRouter = Router();

/**
 * Sales, spend and stall hours between two dates (both included).
 * Profit here is takings minus purchases in the same dates, so it swings on
 * the days a big stock-up happens; the longer the range, the fairer it is.
 */
reportsRouter.get('/', async (req, res) => {
  const { from, to } = parse(z.object({ from: dayString, to: dayString }), req.query);
  if (from > to) throw new HttpError(400, 'Start date is after end date');

  const [products, orders, purchases, logs, sessions, usage] = await Promise.all([
    Product.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
    Order.find({ day: { $gte: from, $lte: to } }).lean(),
    Purchase.find({ date: { $gte: from, $lte: to } }).lean(),
    DayLog.find({ day: { $gte: from, $lte: to } }).lean(),
    StallSession.find({ day: { $gte: from, $lte: to } }).lean(),
    Usage.find({ date: { $gte: from, $lte: to } }, { date: 1, cost: 1 }).lean(),
  ]);

  const ordersByDay = new Map<string, typeof orders>();
  for (const o of orders) ordersByDay.set(o.day, [...(ordersByDay.get(o.day) ?? []), o]);
  const spendByDay = new Map<string, number>();
  for (const p of purchases) spendByDay.set(p.date, (spendByDay.get(p.date) ?? 0) + p.amount);
  const logByDay = new Map(logs.map((l) => [l.day, l]));
  const usedByDay = new Map<string, number>();
  for (const u of usage) usedByDay.set(u.date, (usedByDay.get(u.date) ?? 0) + u.cost);
  const sessionsByDay = new Map<string, typeof sessions>();
  for (const s of sessions) sessionsByDay.set(s.day, [...(sessionsByDay.get(s.day) ?? []), s]);

  const days = eachDay(from, to).map((day) => {
    const s = summarise(ordersByDay.get(day) ?? []);
    const log = logByDay.get(day);
    const prepared = log?.prepared ?? [];
    return {
      day,
      orderCount: s.orderCount,
      units: s.units,
      unitsByProduct: Object.fromEntries(s.unitsByProduct),
      prepared: prepared.length ? prepared.reduce((sum, p) => sum + p.qty, 0) : null,
      gross: s.gross,
      discount: s.discount,
      net: s.net,
      cash: s.cash,
      online: s.online,
      spend: spendByDay.get(day) ?? 0,
      usedCost: usedByDay.get(day) ?? 0,
      sessionCount: sessionsByDay.get(day)?.length ?? 0,
      workedMs: totalMs(sessionsByDay.get(day) ?? []),
      // Sales typed in afterwards on Past days, rather than rung up order by order
      entered: (ordersByDay.get(day) ?? []).some((o) => o.source === 'summary'),
    };
  });

  const all = summarise(orders);
  const spend = purchases.reduce((sum, p) => sum + p.amount, 0);
  const usedCost = usage.reduce((sum, u) => sum + u.cost, 0);
  // Cost per tiramisu only from days where both the usage and the number made were entered
  const costedDays = days.filter((d) => d.usedCost > 0 && d.prepared);
  const costedMade = costedDays.reduce((sum, d) => sum + (d.prepared ?? 0), 0);
  const costedUsed = costedDays.reduce((sum, d) => sum + d.usedCost, 0);
  const totalWorked = days.reduce((sum, d) => sum + d.workedMs, 0);
  const unitsWhileClocked = days.filter((d) => d.workedMs > 0).reduce((sum, d) => sum + d.units, 0);

  const spendByItem = new Map<string, number>();
  for (const p of purchases) spendByItem.set(p.item, (spendByItem.get(p.item) ?? 0) + p.amount);

  const revenueByProduct = new Map<string, number>();
  for (const o of orders) {
    for (const i of o.items) {
      const id = String(i.product);
      revenueByProduct.set(id, (revenueByProduct.get(id) ?? 0) + i.unitPrice * i.qty);
    }
  }

  res.json({
    from,
    to,
    totals: {
      orderCount: all.orderCount,
      units: all.units,
      gross: all.gross,
      discount: all.discount,
      net: all.net,
      cash: all.cash,
      online: all.online,
      spend,
      // Cost of the ingredients actually used: the fairer cost to set against takings
      usedCost,
      usageLogged: usage.length > 0,
      costPerTiramisu: costedMade > 0 ? costedUsed / costedMade : null,
      profit: all.net - (usage.length > 0 ? usedCost : spend),
      workedMs: totalWorked,
      stallDays: days.filter((d) => d.workedMs > 0 || d.orderCount > 0).length,
      // Only days with the clock used count, so a day without timing does not inflate the rate
      unitsPerHour: totalWorked >= MIN_RATE_MS ? unitsWhileClocked / (totalWorked / 3_600_000) : null,
    },
    products: products
      .filter((p) => p.active || all.unitsByProduct.has(String(p._id)))
      .map((p) => ({
        productId: String(p._id),
        name: p.name,
        units: all.unitsByProduct.get(String(p._id)) ?? 0,
        gross: revenueByProduct.get(String(p._id)) ?? 0,
      })),
    spendByItem: [...spendByItem.entries()]
      .map(([item, amount]) => ({ item, amount }))
      .sort((a, b) => b.amount - a.amount),
    days,
  });
});
