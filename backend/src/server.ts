import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

async function start(): Promise<void> {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, `Ivy Backend running on :${env.PORT}`);
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutdown received — closing server');
    server.close(() => {
      logger.info('Server closed cleanly');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
