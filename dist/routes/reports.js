import { Router } from 'express';
import { z } from 'zod';
import { DayLog } from '../models/DayLog.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Purchase } from '../models/Purchase.js';
import { summarise, workedMs } from '../services/dayView.js';
import { eachDay } from '../utils/dates.js';
import { HttpError, dayString, parse } from '../utils/http.js';
export const reportsRouter = Router();
// A rate over a few seconds of clock time is noise, not a speed
const MIN_RATE_MS = 5 * 60_000;
/**
 * Sales, spend and stall hours between two dates (both included).
 * Profit here is takings minus purchases in the same dates, so it swings on
 * the days a big stock-up happens; the longer the range, the fairer it is.
 */
reportsRouter.get('/', async (req, res) => {
    const { from, to } = parse(z.object({ from: dayString, to: dayString }), req.query);
    if (from > to)
        throw new HttpError(400, 'Start date is after end date');
    const [products, orders, purchases, logs] = await Promise.all([
        Product.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
        Order.find({ day: { $gte: from, $lte: to } }).lean(),
        Purchase.find({ date: { $gte: from, $lte: to } }).lean(),
        DayLog.find({ day: { $gte: from, $lte: to } }).lean(),
    ]);
    const ordersByDay = new Map();
    for (const o of orders)
        ordersByDay.set(o.day, [...(ordersByDay.get(o.day) ?? []), o]);
    const spendByDay = new Map();
    for (const p of purchases)
        spendByDay.set(p.date, (spendByDay.get(p.date) ?? 0) + p.amount);
    const logByDay = new Map(logs.map((l) => [l.day, l]));
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
            workedMs: workedMs(log?.shifts ?? []),
        };
    });
    const all = summarise(orders);
    const spend = purchases.reduce((sum, p) => sum + p.amount, 0);
    const totalWorked = days.reduce((sum, d) => sum + d.workedMs, 0);
    const unitsWhileClocked = days.filter((d) => d.workedMs > 0).reduce((sum, d) => sum + d.units, 0);
    const spendByItem = new Map();
    for (const p of purchases)
        spendByItem.set(p.item, (spendByItem.get(p.item) ?? 0) + p.amount);
    const revenueByProduct = new Map();
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
            profit: all.net - spend,
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
//# sourceMappingURL=reports.js.map