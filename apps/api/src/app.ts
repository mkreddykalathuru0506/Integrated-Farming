import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './auth/routes';
import { errorHandler } from './errors';

/** Builds the Express app. Exported separately so tests can mount it without listening. */
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'ifm-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);

  // JSON 404 fallback — no dead ends, consistent error shape.
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
  });

  // Terminal error handler (after routes).
  app.use(errorHandler);

  return app;
}
