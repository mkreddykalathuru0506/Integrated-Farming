import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './auth/routes';
import { meRouter, farmRouter } from './rbac/routes';
import { farmsRouter, farmCrudRouter } from './farms/routes';
import {
  speciesRouter,
  batchRouter,
  animalRouter,
  mortalityRouter,
  movementRouter,
} from './livestock/routes';
import { workerRouter, attendanceRouter } from './labour/routes';
import { scheduleRouter, taskRouter } from './tasks/routes';
import { logRouter } from './logs/routes';
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
  app.use('/api/me', meRouter);
  app.use('/api/farms', farmsRouter);
  app.use('/api/farm', farmRouter);
  app.use('/api/farm', farmCrudRouter);
  app.use('/api/farm/species', speciesRouter);
  app.use('/api/farm/batches', batchRouter);
  app.use('/api/farm/animals', animalRouter);
  app.use('/api/farm/mortality', mortalityRouter);
  app.use('/api/farm/movements', movementRouter);
  app.use('/api/farm/workers', workerRouter);
  app.use('/api/farm/attendance', attendanceRouter);
  app.use('/api/farm/schedules', scheduleRouter);
  app.use('/api/farm/tasks', taskRouter);
  app.use('/api/farm/logs', logRouter);

  // JSON 404 fallback — no dead ends, consistent error shape.
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
  });

  // Terminal error handler (after routes).
  app.use(errorHandler);

  return app;
}
