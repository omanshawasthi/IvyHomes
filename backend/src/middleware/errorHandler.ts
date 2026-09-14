import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { IvyApiError } from '../ivy-client/IvyApiClient.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

/**
 * Centralised error handler — last middleware in the chain.
 *
 * Security contract:
 *   - Stack traces are NEVER sent to the client in production.
 *   - Internal error messages are logged server-side only.
 *   - Only a sanitized message + request ID reaches the client.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId;

  // ── Zod validation errors ────────────────────────────────────────────────
  if (err instanceof ZodError) {
    logger.warn({ requestId, errors: err.flatten() }, 'Validation error');
    res.status(400).json({
      error: 'Validation error',
      details: err.flatten().fieldErrors,
      requestId,
    });
    return;
  }

  // ── Upstream API errors ──────────────────────────────────────────────────
  if (err instanceof IvyApiError) {
    logger.warn({ requestId, status: err.status, endpoint: err.endpoint }, err.message);
    // Proxy the upstream status; surface the detail message (it's written to be useful)
    res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({
      error: err.detail,
      requestId,
    });
    return;
  }

  // ── Generic errors ───────────────────────────────────────────────────────
  const isError = err instanceof Error;
  logger.error(
    { requestId, err: isError ? { message: err.message, stack: err.stack } : err },
    'Unhandled error',
  );

  res.status(500).json({
    error: env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : (isError ? err.message : 'Unknown error'),
    requestId,
  });
}
