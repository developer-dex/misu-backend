import { config } from '../config.js';
/** A calendar day in the business time zone, as YYYY-MM-DD. */
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export function todayInBusinessZone(now = new Date()) {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: config.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}
/** Every day from `from` to `to`, both included. */
export function eachDay(from, to) {
    const days = [];
    const cursor = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (cursor <= end && days.length < 1000) {
        days.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
}
export function isValidDay(value) {
    if (!DAY_PATTERN.test(value))
        return false;
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
//# sourceMappingURL=dates.js.map