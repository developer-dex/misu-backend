import { DayLog } from '../models/DayLog.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
export function workedMs(shifts, now = Date.now()) {
    return shifts.reduce((sum, s) => sum + ((s.end ? s.end.getTime() : now) - s.start.getTime()), 0);
}
/** Totals for a set of orders. Cash and online are what was actually collected (after discount). */
export function summarise(orders) {
    const unitsByProduct = new Map();
    let units = 0;
    let gross = 0;
    let discount = 0;
    let net = 0;
    let cash = 0;
    let online = 0;
    for (const o of orders) {
        for (const item of o.items) {
            const id = String(item.product);
            unitsByProduct.set(id, (unitsByProduct.get(id) ?? 0) + item.qty);
            units += item.qty;
        }
        gross += o.subtotal;
        discount += o.discount;
        net += o.total;
        if (o.payment === 'cash')
            cash += o.total;
        else
            online += o.total;
    }
    return { orderCount: orders.length, units, unitsByProduct, gross, discount, net, cash, online };
}
/** Everything the Sell screen needs for one day. */
export async function buildDayView(day) {
    const [products, log, orders] = await Promise.all([
        Product.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
        DayLog.findOne({ day }).lean(),
        Order.find({ day }).sort({ createdAt: -1 }).lean(),
    ]);
    const shifts = (log?.shifts ?? []).map((s) => ({ start: s.start, end: s.end ?? null }));
    const prepared = new Map((log?.prepared ?? []).map((p) => [String(p.product), p.qty]));
    const totals = summarise(orders);
    const byProduct = products
        .filter((p) => p.active || totals.unitsByProduct.has(String(p._id)) || prepared.has(String(p._id)))
        .map((p) => {
        const id = String(p._id);
        return {
            productId: id,
            name: p.name,
            sold: totals.unitsByProduct.get(id) ?? 0,
            prepared: prepared.has(id) ? prepared.get(id) : null,
        };
    });
    return {
        day,
        serverTime: new Date().toISOString(),
        shifts,
        running: shifts.some((s) => s.end === null),
        workedMs: workedMs(shifts),
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
        orders: orders.map((o) => ({
            id: String(o._id),
            createdAt: o.createdAt,
            items: o.items.map((i) => ({ productId: String(i.product), name: i.name, unitPrice: i.unitPrice, qty: i.qty })),
            subtotal: o.subtotal,
            discount: o.discount,
            total: o.total,
            payment: o.payment,
            note: o.note ?? '',
        })),
    };
}
//# sourceMappingURL=dayView.js.map