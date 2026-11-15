import { Router } from 'express';
import { z } from 'zod';
import { clearDayOff } from '../models/DayLog.js';
import { ON_HOLD, Order, PAYMENT_METHODS } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { StallSession } from '../models/StallSession.js';
import { buildDayView } from '../services/dayView.js';
import { HttpError, dayString, idParam, money, objectId, parse } from '../utils/http.js';

export const ordersRouter = Router();

const orderInput = z.object({
  day: dayString,
  items: z
    .array(z.object({ productId: objectId, qty: z.coerce.number().int().min(1).max(500) }))
    .min(1, 'Pick at least one tiramisu')
    .max(20),
  discount: money.default(0),
  // 'hold': the customer pays later, when they collect it
  payment: z.enum([...PAYMENT_METHODS, 'hold'], { message: 'Choose cash, online or on hold' }),
  customer: z
    .object({
      name: z.string().trim().max(60),
      phone: z
        .string()
        .trim()
        .max(20)
        .regex(/^[\d+\-\s()]*$/, 'Phone number can only have digits')
        .default(''),
    })
    .optional(),
  note: z.string().trim().max(200).optional(),
});

/** Records a sale and returns the updated day. */
ordersRouter.post('/', async (req, res) => {
  const body = parse(orderInput, req.body);
  const onHold = body.payment === 'hold';
  if (onHold && !body.customer?.name) throw new HttpError(400, 'Enter the customer name for an order on hold');

  // Same flavour picked twice becomes one line
  const qtyById = new Map<string, number>();
  for (const i of body.items) qtyById.set(i.productId, (qtyById.get(i.productId) ?? 0) + i.qty);

  // A sale made while the clock runs belongs to that session (only when it is for the same day)
  const [products, open] = await Promise.all([
    Product.find({ _id: { $in: [...qtyById.keys()] } }).lean(),
    StallSession.findOne({ end: null, day: body.day }, { _id: 1 }).lean(),
  ]);
  if (products.length !== qtyById.size) throw new HttpError(400, 'Unknown flavour');

  const items = products.map((p) => ({ product: p._id, name: p.name, unitPrice: p.price, qty: qtyById.get(String(p._id))! }));
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  if (body.discount > subtotal) throw new HttpError(400, 'Discount is more than the order total');

  const [order] = await Promise.all([
    Order.create({
      day: body.day,
      session: open?._id ?? null,
      items,
      subtotal,
      discount: body.discount,
      total: Math.round((subtotal - body.discount) * 100) / 100,
      payment: onHold ? null : body.payment,
      customer: body.customer?.name ? body.customer : null,
      paidAt: onHold ? null : new Date(),
      note: body.note,
    }),
    clearDayOff(body.day),
  ]);

  res.status(201).json({ orderId: String(order._id), day: await buildDayView(body.day) });
});

/** Sets how an order was paid; paying an order on hold takes it off hold. */
ordersRouter.patch('/:id', async (req, res) => {
  const { payment } = parse(z.object({ payment: z.enum(PAYMENT_METHODS, { message: 'Choose cash or online' }) }), req.body);
  const id = idParam(req);
  const wasHeld = await Order.exists({ _id: id, ...ON_HOLD });
  const order = await Order.findByIdAndUpdate(id, { payment, ...(wasHeld ? { paidAt: new Date() } : {}) }, { new: true });
  if (!order) throw new HttpError(404, 'Order not found');
  res.json({ day: await buildDayView(order.day) });
});

ordersRouter.delete('/:id', async (req, res) => {
  const order = await Order.findByIdAndDelete(idParam(req));
  if (!order) throw new HttpError(404, 'Order not found');
  res.json({ day: await buildDayView(order.day) });
});
