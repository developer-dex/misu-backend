import { Router } from 'express';
import { z } from 'zod';
import { DayLog } from '../models/DayLog.js';
import { Ingredient } from '../models/Ingredient.js';
import { Usage } from '../models/Usage.js';
import { averageUnitCost, stockSummary } from '../services/stock.js';
import { HttpError, dayString, idParam, money, objectId, parse } from '../utils/http.js';
import { round2 } from '../utils/units.js';

export const usageRouter = Router();

const toJson = (u: {
  _id: unknown;
  date: string;
  ingredient: unknown;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  cost: number;
  costSource: string;
  note?: string | null;
  createdAt?: Date;
}) => ({
  id: String(u._id),
  date: u.date,
  ingredientId: String(u.ingredient),
  name: u.name,
  quantity: u.quantity,
  unit: u.unit,
  unitCost: u.unitCost,
  cost: u.cost,
  costSource: u.costSource,
  note: u.note ?? '',
  createdAt: u.createdAt,
});

const quantity = z.coerce.number().positive('Enter how much you used').max(1_000_000);

/** Usage between two dates, and how many tiramisu were made on each of those days. */
usageRouter.get('/', async (req, res) => {
  const { from, to } = parse(z.object({ from: dayString, to: dayString }), req.query);
  const [entries, logs] = await Promise.all([
    Usage.find({ date: { $gte: from, $lte: to } }).sort({ date: -1, createdAt: -1 }).lean(),
    DayLog.find({ day: { $gte: from, $lte: to } }, { day: 1, prepared: 1 }).lean(),
  ]);
  const madeByDay: Record<string, number> = {};
  for (const l of logs) if (l.prepared.length) madeByDay[l.day] = l.prepared.reduce((sum, p) => sum + p.qty, 0);
  res.json({ entries: entries.map(toJson), madeByDay });
});

/**
 * Records an amount used. The cost is the quantity times the average price
 * paid per unit, unless a cost is typed in (needed when there is no priced
 * purchase of the item yet).
 */
usageRouter.post('/', async (req, res) => {
  const body = parse(
    z.object({
      date: dayString,
      ingredientId: objectId,
      quantity,
      cost: money.optional(),
      note: z.string().trim().max(200).optional(),
    }),
    req.body,
  );
  const ingredient = await Ingredient.findById(body.ingredientId).lean();
  if (!ingredient) throw new HttpError(404, 'That item is no longer on the purchase list');

  let unitCost: number;
  let costSource: 'average' | 'manual';
  if (body.cost !== undefined) {
    unitCost = body.cost / body.quantity;
    costSource = 'manual';
  } else {
    const average = await averageUnitCost(ingredient);
    if (average === null) {
      throw new HttpError(
        400,
        `No ${ingredient.name} purchase with a quantity in ${ingredient.unit} yet, so the cost can't be worked out. Enter what this amount cost.`,
      );
    }
    unitCost = average;
    costSource = 'average';
  }

  const entry = await Usage.create({
    date: body.date,
    ingredient: ingredient._id,
    name: ingredient.name,
    quantity: body.quantity,
    unit: ingredient.unit,
    unitCost,
    cost: round2(unitCost * body.quantity),
    costSource,
    note: body.note ?? '',
  });
  res.status(201).json(toJson(entry));
});

/** Changes the amount (keeping the price per unit it was saved with), the date, the note, or sets a typed-in cost. */
usageRouter.patch('/:id', async (req, res) => {
  const body = parse(
    z.object({
      date: dayString.optional(),
      quantity: quantity.optional(),
      cost: money.optional(),
      note: z.string().trim().max(200).optional(),
    }),
    req.body,
  );
  const entry = await Usage.findById(idParam(req));
  if (!entry) throw new HttpError(404, 'Entry not found');

  if (body.date) entry.date = body.date;
  if (body.note !== undefined) entry.note = body.note;
  if (body.quantity !== undefined) entry.quantity = body.quantity;
  if (body.cost !== undefined) {
    entry.unitCost = body.cost / entry.quantity;
    entry.costSource = 'manual';
  }
  entry.cost = round2(entry.unitCost * entry.quantity);
  await entry.save();
  res.json(toJson(entry));
});

usageRouter.delete('/:id', async (req, res) => {
  const entry = await Usage.findByIdAndDelete(idParam(req));
  if (!entry) throw new HttpError(404, 'Entry not found');
  res.status(204).end();
});

export const stockRouter = Router();

stockRouter.get('/', async (_req, res) => {
  res.json(await stockSummary());
});
