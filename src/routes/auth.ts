import { Router } from 'express';
import { z } from 'zod';
import { clearFailedLogins, issueToken, loginLimiter, recordFailedLogin, requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { HttpError, parse } from '../utils/http.js';
import { burnPasswordCheck, verifyPassword } from '../utils/password.js';

export const authRouter = Router();

const credentials = z.object({
  username: z.string().trim().toLowerCase().min(1, 'Enter your username').max(40),
  password: z.string().min(1, 'Enter your password').max(200),
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = parse(credentials, req.body);
  const user = await User.findOne({ username });

  // Same message and timing whether the username or the password is wrong
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false);
  if (!user || !ok) {
    recordFailedLogin(req);
    throw new HttpError(401, 'Wrong username or password');
  }

  clearFailedLogins(req);
  user.lastLoginAt = new Date();
  await user.save();

  const { token, expiresAt } = issueToken({ id: String(user._id), tokenVersion: user.tokenVersion });
  res.json({ token, expiresAt, user: { username: user.username } });
});

/** Lets the client check a stored token is still good, and who it belongs to. */
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: { username: req.user!.username } });
});
