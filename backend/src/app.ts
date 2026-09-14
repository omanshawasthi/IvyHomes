import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { CONSTANTS } from './config/constants.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { authRouter } from './routes/auth.js';
import { listingsRouter } from './routes/listings.js';
import { rentalsRouter } from './routes/rentals.js';
import { projectsRouter } from './routes/projects.js';
import { favouritesRouter } from './routes/favourites.js';
import { analyticsRouter } from './routes/analytics.js';

export function createApp(): express.Application {
  const app = express();

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // ── CORS — explicit allowlist only, never * ───────────────────────────────
  app.use(cors({
    origin:         env.FRONTEND_ORIGIN,
    credentials:    true,
    methods:        ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ── Rate limiting on our own API ──────────────────────────────────────────
  app.use(rateLimit({
    windowMs:       CONSTANTS.RATE_LIMIT.WINDOW_MS,
    max:            CONSTANTS.RATE_LIMIT.MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders:  false,
    message: { detail: 'Too many requests — please slow down' },
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(requestId);

  // ── Health ────────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // ── API routes ────────────────────────────────────────────────────────────
  app.use('/api/auth',       authRouter);
  app.use('/api/listings',   listingsRouter);
  app.use('/api/rentals',    rentalsRouter);
  app.use('/api/projects',   projectsRouter);
  app.use('/api/favourites', favouritesRouter);
  app.use('/api/analytics',  analyticsRouter);

  // ── Error handler (last) ──────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
