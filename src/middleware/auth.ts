import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { HttpError } from '../utils/http.js';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface TokenPayload {
  sub: string; // user id
  ver: number; // user's tokenVersion when issued
  exp: number; // epoch ms
}

export interface AuthedUser {
  id: string;
  username: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthedUser;
  }
}

function sign(payload: string): string {
  return createHmac('sha256', config.authSecret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** A signed token: base64url(JSON payload) + "." + HMAC-SHA256 signature. */
export function issueToken(user: { id: string; tokenVersion: number }): { token: string; expiresAt: number } {
  const payload: TokenPayload = { sub: user.id, ver: user.tokenVersion, exp: Date.now() + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${body}.${sign(body)}`, expiresAt: payload.exp };
}

function readToken(token: string): TokenPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature || !safeEqual(signature, sign(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
    return typeof payload.sub === 'string' && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/** Blocks API calls without a valid token for a user that still exists and has not changed password. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const payload = header.startsWith('Bearer ') ? readToken(header.slice(7)) : null;
  if (!payload || !/^[a-f\d]{24}$/i.test(payload.sub)) throw new HttpError(401, 'Please log in again');

  const user = await User.findById(payload.sub, { username: 1, tokenVersion: 1 }).lean();
  if (!user || user.tokenVersion !== payload.ver) throw new HttpError(401, 'Please log in again');

  req.user = { id: String(user._id), username: user.username };
  next();
}

/** A small in-memory limit on failed logins, per client address. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function loginLimiter(req: Request, _res: Response, next: NextFunction): void {
  const entry = attempts.get(req.ip ?? 'unknown');
  if (entry && entry.resetAt > Date.now() && entry.count >= MAX_ATTEMPTS) {
    throw new HttpError(429, 'Too many tries. Wait 15 minutes and try again.');
  }
  next();
}

export function recordFailedLogin(req: Request): void {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearFailedLogins(req: Request): void {
  attempts.delete(req.ip ?? 'unknown');
}
