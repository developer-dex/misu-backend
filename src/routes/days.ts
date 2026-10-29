import { Router } from 'express';
import { z } from 'zod';
import { DayLog } from '../models/DayLog.js';
import { Product } from '../models/Product.js';
import { buildDayView } from '../services/dayView.js';
import { todayInBusinessZone } from '../utils/dates.js';
import { HttpError, dayString, objectId, parse } from '../utils/http.js';

export const daysRouter = Router();

function dayParam(value: unknown): string {
  return parse(dayString, value);
}

/**
 * The day the Sell screen should open on: the day whose shift is still running
 * (so a stall that runs past midnight keeps its orders on the day it started),
 * otherwise the date the device sends.
 */
daysRouter.get('/current', async (req, res) => {
  const requested = req.query.date ? dayParam(req.query.date) : todayInBusinessZone();
  const open = await DayLog.findOne({ shifts: { $elemMatch: { end: null } } }).lean();
  res.json(await buildDayView(open?.day ?? requested));
});

daysRouter.get('/:day', async (req, res) => {
  res.json(await buildDayView(dayParam(req.params.day)));
});

daysRouter.post('/:day/shift/start', async (req, res) => {
  const day = dayParam(req.params.day);
  const open = await DayLog.findOne({ shifts: { $elemMatch: { end: null } } }).lean();
  if (open) {
    throw new HttpError(409, open.day === day ? 'The clock is already running' : `The clock for ${open.day} is still running. Stop it first.`);
  }
  await DayLog.updateOne({ day }, { $push: { shifts: { start: new Date(), end: null } } }, { upsert: true });
  res.json(await buildDayView(day));
});

daysRouter.post('/:day/shift/stop', async (req, res) => {
  const day = dayParam(req.params.day);
  const result = await DayLog.updateOne(
    { day, shifts: { $elemMatch: { end: null } } },
    { $set: { 'shifts.$.end': new Date() } },
  );
  if (result.matchedCount === 0) throw new HttpError(409, 'The clock is not running');
  res.json(await buildDayView(day));
});

daysRouter.put('/:day/prepared', async (req, res) => {
  const day = dayParam(req.params.day);
  const { items } = parse(
    z.object({
      items: z
        .array(z.object({ productId: objectId, qty: z.coerce.number().int().min(0).max(10_000) }))
        .max(50),
    }),
    req.body,
  );
  const known = await Product.countDocuments({ _id: { $in: items.map((i) => i.productId) } });
  if (known !== new Set(items.map((i) => i.productId)).size) throw new HttpError(400, 'Unknown flavour');
  await DayLog.updateOne(
    { day },
    { $set: { prepared: items.map((i) => ({ product: i.productId, qty: i.qty })) } },
    { upsert: true },
  );
  res.json(await buildDayView(day));
});
