import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

/**
 * Extracts the Bearer token from the httpOnly session cookie.
 * The cookie is set by POST /api/auth/login and carries the Ivy token.
 *
 * If no valid cookie exists, returns 401.
 * Attaches the token to req.ivyToken for downstream use.
 */

declare global {
  namespace Express {
    interface Request {
      ivyToken: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies['ivy_session'] as string | undefined;

  if (!token || typeof token !== 'string' || token.length === 0) {
    logger.debug({ requestId: req.requestId, path: req.path }, 'Unauthenticated request rejected');
    res.status(401).json({ error: 'Not authenticated', requestId: req.requestId });
    return;
  }

  req.ivyToken = token;
  next();
}
