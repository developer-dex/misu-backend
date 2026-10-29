import { Router } from 'express';
import { z } from 'zod';
import { Order, PAYMENT_METHODS } from '../models/Order.js';
import { Product } from '../models/Product.js';
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
  payment: z.enum(PAYMENT_METHODS, { message: 'Choose cash or online' }),
  note: z.string().trim().max(200).optional(),
});

/** Records a sale and returns the updated day. */
ordersRouter.post('/', async (req, res) => {
  const body = parse(orderInput, req.body);

  // Same flavour picked twice becomes one line
  const qtyById = new Map<string, number>();
  for (const i of body.items) qtyById.set(i.productId, (qtyById.get(i.productId) ?? 0) + i.qty);

  const products = await Product.find({ _id: { $in: [...qtyById.keys()] } }).lean();
  if (products.length !== qtyById.size) throw new HttpError(400, 'Unknown flavour');

  const items = products.map((p) => ({ product: p._id, name: p.name, unitPrice: p.price, qty: qtyById.get(String(p._id))! }));
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  if (body.discount > subtotal) throw new HttpError(400, 'Discount is more than the order total');

  const order = await Order.create({
    day: body.day,
    items,
    subtotal,
    discount: body.discount,
    total: Math.round((subtotal - body.discount) * 100) / 100,
    payment: body.payment,
    note: body.note,
  });

  res.status(201).json({ orderId: String(order._id), day: await buildDayView(body.day) });
});

ordersRouter.patch('/:id', async (req, res) => {
  const body = parse(z.object({ payment: z.enum(PAYMENT_METHODS) }), req.body);
  const order = await Order.findByIdAndUpdate(idParam(req), body, { new: true });
  if (!order) throw new HttpError(404, 'Order not found');
  res.json({ day: await buildDayView(order.day) });
});

ordersRouter.delete('/:id', async (req, res) => {
  const order = await Order.findByIdAndDelete(idParam(req));
  if (!order) throw new HttpError(404, 'Order not found');
  res.json({ day: await buildDayView(order.day) });
});
