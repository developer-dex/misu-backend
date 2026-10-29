import { summarise } from './totals.js';

// A rate over a few seconds of clock time is noise, not a speed
export const MIN_RATE_MS = 5 * 60_000;

type SessionDoc = {
  _id: unknown;
  day: string;
  start: Date;
  end?: Date | null;
  startedBy?: string | null;
  stoppedBy?: string | null;
};

type OrderDoc = Parameters<typeof summarise>[0][number];

export function sessionMs(s: { start: Date; end?: Date | null }, now = Date.now()): number {
  return (s.end ? s.end.getTime() : now) - s.start.getTime();
}

export function totalMs(sessions: { start: Date; end?: Date | null }[], now = Date.now()): number {
  return sessions.reduce((sum, s) => sum + sessionMs(s, now), 0);
}

/** A session with what was sold during it. `number` is its place in the day (1st, 2nd…). */
export function sessionJson(s: SessionDoc, orders: OrderDoc[], number: number) {
  const totals = summarise(orders);
  const durationMs = sessionMs(s);
  return {
    id: String(s._id),
    number,
    day: s.day,
    start: s.start,
    end: s.end ?? null,
    running: !s.end,
    durationMs,
    startedBy: s.startedBy ?? null,
    stoppedBy: s.stoppedBy ?? null,
    orderCount: totals.orderCount,
    units: totals.units,
    unitsByProduct: Object.fromEntries(totals.unitsByProduct),
    gross: totals.gross,
    discount: totals.discount,
    net: totals.net,
    cash: totals.cash,
    online: totals.online,
    unitsPerHour: durationMs >= MIN_RATE_MS ? totals.units / (durationMs / 3_600_000) : null,
  };
}

/** Groups orders by the session they belong to; orders made with the clock stopped go under ''. */
export function ordersBySession<T extends { session?: unknown }>(orders: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const o of orders) {
    const key = o.session ? String(o.session) : '';
    map.set(key, [...(map.get(key) ?? []), o]);
  }
  return map;
}
