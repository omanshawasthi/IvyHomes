import pino from 'pino';
import { env } from './env.js';

/**
 * Structured logger using pino.
 *
 * Security contract:
 * - NEVER log: IVY_API_KEY, MONGODB_URI credentials, session tokens, user passwords
 * - DO log: request IDs, timing, structured error objects (without secrets)
 */
export const logger = pino(
  {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    // Redact any field that could leak secrets, even accidentally
    redact: {
      paths: [
        'api_key',
        'apiKey',
        'token',
        'password',
        'Authorization',
        'cookie',
        '*.api_key',
        '*.token',
        '*.password',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  },
  env.NODE_ENV === 'development'
    ? pino.transport({ target: 'pino-pretty', options: { colorize: true } })
    : undefined,
);
