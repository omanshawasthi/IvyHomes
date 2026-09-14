import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Attaches a unique request ID to every request.
 * Used by the error handler and structured logging for tracing.
 */
export function requestId(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = (req.headers['x-request-id'] as string | undefined) ?? uuidv4();
  logger.debug({ requestId: req.requestId, method: req.method, path: req.path }, 'Incoming request');
  next();
}
