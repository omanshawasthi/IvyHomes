import { Router } from 'express';
import { z } from 'zod';
import { IvyApiClient } from '../ivy-client/IvyApiClient.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

const router = Router();
const client = new IvyApiClient();

const LoginBodySchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/auth/login
 * Proxies to upstream Ivy auth. Stores token in httpOnly cookie only —
 * never in the JSON response body. The client never sees the raw token.
 */
router.post('/login', async (req, res, next) => {
  try {
    const body     = LoginBodySchema.parse(req.body);
    const upstream = await client.login(body.email, body.password);

    res.cookie('ivy_session', upstream.access_token, {
      httpOnly: true,
      secure:   env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   (upstream.expires_in ?? 900) * 1000,
      path:     '/',
    });

    logger.info({ email: body.email, requestId: req.requestId }, 'Login successful');
    res.json({ user: upstream.user });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Session check on page load — cookie present = authenticated.
 * Does NOT re-hit upstream. The 24 h cookie expiry is the TTL.
 */
router.get('/me', (req, res) => {
  const token = req.cookies['ivy_session'] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({ authenticated: true });
});

/**
 * POST /api/auth/logout
 * Clears cookie and invalidates upstream token.
 */
router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies['ivy_session'] as string | undefined;
    if (token) {
      try { await client.logout(token); }
      catch { /* still clear the cookie even if upstream fails */ }
    }
    res.clearCookie('ivy_session', { path: '/' });
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
