import { createHmac, timingSafeEqual } from 'node:crypto';
import { authEnabled, config } from '../config.js';
import { HttpError } from '../utils/http.js';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
function sign(payload) {
    return createHmac('sha256', config.authSecret).update(payload).digest('base64url');
}
function safeEqual(a, b) {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
}
export function issueToken() {
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    const payload = String(expiresAt);
    return { token: `${payload}.${sign(payload)}`, expiresAt };
}
export function checkPasscode(candidate) {
    // Hash both sides so the comparison takes the same time whatever the lengths
    const a = sign(`passcode:${candidate}`);
    const b = sign(`passcode:${config.passcode}`);
    return safeEqual(a, b);
}
function tokenIsValid(token) {
    const [payload, signature] = token.split('.');
    if (!payload || !signature || !safeEqual(signature, sign(payload)))
        return false;
    return Number(payload) > Date.now();
}
/** Blocks API calls without a valid token. Does nothing when no passcode is configured. */
export function requireAuth(req, _res, next) {
    if (!authEnabled)
        return next();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !tokenIsValid(token)) {
        throw new HttpError(401, 'Please log in again');
    }
    next();
}
/** A small in-memory limit on wrong passcodes, per client address. */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
export function loginLimiter(req, _res, next) {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = attempts.get(key);
    if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
        throw new HttpError(429, 'Too many tries. Wait 15 minutes and try again.');
    }
    next();
}
export function recordFailedLogin(req) {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = attempts.get(key);
    if (!entry || entry.resetAt <= now) {
        attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    }
    else {
        entry.count += 1;
    }
}
//# sourceMappingURL=auth.js.map