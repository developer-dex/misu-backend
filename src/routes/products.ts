import { Router } from 'express';
import { z } from 'zod';
import { Product } from '../models/Product.js';
import { HttpError, idParam, money, parse } from '../utils/http.js';

export const productsRouter = Router();

const toJson = (p: { _id: unknown; name: string; price: number; active: boolean; sortOrder: number }) => ({
  id: String(p._id),
  name: p.name,
  price: p.price,
  active: p.active,
  sortOrder: p.sortOrder,
});

productsRouter.get('/', async (_req, res) => {
  const products = await Product.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
  res.json(products.map(toJson));
});

productsRouter.post('/', async (req, res) => {
  const body = parse(
    z.object({
      name: z.string().trim().min(1, 'Name is required').max(60),
      price: money,
    }),
    req.body,
  );
  const last = await Product.findOne().sort({ sortOrder: -1 }).lean();
  const product = await Product.create({ ...body, sortOrder: (last?.sortOrder ?? 0) + 1 });
  res.status(201).json(toJson(product));
});

productsRouter.patch('/:id', async (req, res) => {
  const body = parse(
    z.object({
      name: z.string().trim().min(1, 'Name is required').max(60).optional(),
      price: money.optional(),
      active: z.boolean().optional(),
    }),
    req.body,
  );
  const product = await Product.findByIdAndUpdate(idParam(req), body, { new: true, runValidators: true });
  if (!product) throw new HttpError(404, 'Flavour not found');
  res.json(toJson(product));
});
