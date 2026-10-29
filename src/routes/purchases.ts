import { Router } from 'express';
import { z } from 'zod';
import { Purchase } from '../models/Purchase.js';
import { HttpError, dayString, idParam, money, parse } from '../utils/http.js';

export const purchasesRouter = Router();

const toJson = (p: { _id: unknown; date: string; item: string; quantity?: number | null; unit?: string | null; amount: number; note?: string | null; createdAt?: Date }) => ({
  id: String(p._id),
  date: p.date,
  item: p.item,
  quantity: p.quantity ?? null,
  unit: p.unit ?? '',
  amount: p.amount,
  note: p.note ?? '',
  createdAt: p.createdAt,
});

const fields = z.object({
  date: dayString,
  item: z.string().trim().min(1, 'Pick what you bought').max(60),
  quantity: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
  unit: z.string().trim().max(20).optional(),
  amount: money.refine((n) => n > 0, 'Enter the amount paid'),
  note: z.string().trim().max(200).optional(),
});

purchasesRouter.get('/', async (req, res) => {
  const { from, to } = parse(z.object({ from: dayString, to: dayString }), req.query);
  const purchases = await Purchase.find({ date: { $gte: from, $lte: to } })
    .sort({ date: -1, createdAt: -1 })
    .lean();
  res.json(purchases.map(toJson));
});

purchasesRouter.post('/', async (req, res) => {
  const purchase = await Purchase.create(parse(fields, req.body));
  res.status(201).json(toJson(purchase));
});

purchasesRouter.patch('/:id', async (req, res) => {
  const body = parse(fields.partial(), req.body);
  const purchase = await Purchase.findByIdAndUpdate(idParam(req), body, { new: true, runValidators: true });
  if (!purchase) throw new HttpError(404, 'Purchase not found');
  res.json(toJson(purchase));
});

purchasesRouter.delete('/:id', async (req, res) => {
  const purchase = await Purchase.findByIdAndDelete(idParam(req));
  if (!purchase) throw new HttpError(404, 'Purchase not found');
  res.status(204).end();
});
