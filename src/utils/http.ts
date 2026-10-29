import type { Request } from 'express';
import { z } from 'zod';
import { isValidDay } from './dates.js';

/** An error whose message is safe to show to the user. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const dayString = z.string().refine(isValidDay, 'Use a date like 2026-10-29');

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const money = z.coerce.number().min(0, 'Cannot be negative').max(10_000_000).transform((n) => Math.round(n * 100) / 100);

export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
    throw new HttpError(400, `${where}${issue.message}`);
  }
  return result.data;
}

export function idParam(req: Request): string {
  return parse(objectId, req.params.id);
}
