import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { HttpError } from '../utils/http.js';

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, 'Not found'));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    res.status(400).json({ error: first?.message ?? 'Invalid data' });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: `Invalid ${err.path}` });
    return;
  }
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000) {
    res.status(409).json({ error: 'That name is already in use' });
    return;
  }
  if (typeof err === 'object' && err !== null && 'type' in err && (err as { type: unknown }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
}
