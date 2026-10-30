import { Router } from 'express';
import { z } from 'zod';
import { DayLog } from '../models/DayLog.js';
import { Product } from '../models/Product.js';
import { StallSession } from '../models/StallSession.js';
import { buildDayEntry, clearDayEntry, saveDayEntry } from '../services/dayEntry.js';
import { buildDayView } from '../services/dayView.js';
import { todayInBusinessZone } from '../utils/dates.js';
import { HttpError, dayString, money, objectId, parse } from '../utils/http.js';

export const daysRouter = Router();

function dayParam(value: unknown): string {
  return parse(dayString, value);
}

/**
 * The day the Sell screen should open on: the day whose session is still running
 * (so a stall that runs past midnight keeps its orders on the day it started),
 * otherwise the date the device sends.
 */
daysRouter.get('/current', async (req, res) => {
  const requested = req.query.date ? dayParam(req.query.date) : todayInBusinessZone();
  const open = await StallSession.findOne({ end: null }).lean();
  res.json(await buildDayView(open?.day ?? requested));
});

daysRouter.get('/:day', async (req, res) => {
  res.json(await buildDayView(dayParam(req.params.day)));
});

/** Starts the stall clock: a new session in the log. */
daysRouter.post('/:day/session/start', async (req, res) => {
  const day = dayParam(req.params.day);
  const open = await StallSession.findOne({ end: null }).lean();
  if (open) {
    throw new HttpError(409, open.day === day ? 'The clock is already running' : `The clock for ${open.day} is still running. Stop it first.`);
  }
  await StallSession.create({ day, start: new Date(), startedBy: req.user?.username ?? null });
  res.json(await buildDayView(day));
});

/** Stops the running session for this day. */
daysRouter.post('/:day/session/stop', async (req, res) => {
  const day = dayParam(req.params.day);
  const result = await StallSession.updateOne({ day, end: null }, { $set: { end: new Date(), stoppedBy: req.user?.username ?? null } });
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

/* ---------- Past days: a whole day's sales typed in at once ---------- */

const lines = z
  .array(z.object({ productId: objectId, qty: z.coerce.number().int().min(0).max(10_000) }))
  .max(50);

const sale = z.object({ items: lines.default([]), discount: money.default(0) });

const dayEntryInput = z
  .object({
    opened: z.coerce.date().nullable().default(null),
    closed: z.coerce.date().nullable().default(null),
    cash: sale.default({ items: [], discount: 0 }),
    online: sale.default({ items: [], discount: 0 }),
    prepared: lines.nullable().default(null),
  })
  .refine((b) => (b.opened === null) === (b.closed === null), 'Enter both the opening and the closing time, or neither')
  .refine((b) => !b.opened || !b.closed || b.closed > b.opened, 'Closing time must be after opening time')
  .refine((b) => !b.opened || !b.closed || b.closed.getTime() - b.opened.getTime() <= 24 * 3_600_000, 'The stall can be open for 24 hours at most');

function pastDayParam(value: unknown): string {
  const day = dayParam(value);
  if (day > todayInBusinessZone()) throw new HttpError(400, 'That day has not happened yet');
  return day;
}

daysRouter.get('/:day/entry', async (req, res) => {
  res.json(await buildDayEntry(dayParam(req.params.day)));
});

/** Saves (or replaces) the typed-in totals for a day. */
daysRouter.put('/:day/entry', async (req, res) => {
  const day = pastDayParam(req.params.day);
  res.json(await saveDayEntry(day, parse(dayEntryInput, req.body), req.user?.username ?? null));
});

daysRouter.delete('/:day/entry', async (req, res) => {
  res.json(await clearDayEntry(dayParam(req.params.day)));
});
