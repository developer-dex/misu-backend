import { Router } from 'express';
import { z } from 'zod';
import { authEnabled } from '../config.js';
import { checkPasscode, issueToken, loginLimiter, recordFailedLogin, requireAuth } from '../middleware/auth.js';
import { HttpError, parse } from '../utils/http.js';
export const authRouter = Router();
/** Tells the client whether it has to show the login screen. */
authRouter.get('/status', (_req, res) => {
    res.json({ authRequired: authEnabled });
});
authRouter.post('/login', loginLimiter, (req, res) => {
    if (!authEnabled) {
        res.json({ token: null, expiresAt: null });
        return;
    }
    const { passcode } = parse(z.object({ passcode: z.string().max(200) }), req.body);
    if (!checkPasscode(passcode)) {
        recordFailedLogin(req);
        throw new HttpError(401, 'Wrong passcode');
    }
    res.json(issueToken());
});
/** Lets the client check a stored token is still good. */
authRouter.get('/me', requireAuth, (_req, res) => {
    res.json({ ok: true });
});
//# sourceMappingURL=auth.js.map