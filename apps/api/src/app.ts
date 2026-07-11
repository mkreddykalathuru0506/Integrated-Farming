import express, { type Express } from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import { authRouter } from './auth/routes';
import { meRouter, farmRouter } from './rbac/routes';
import { profileRouter } from './me/routes';
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
import { healthRouter } from './health/routes';
import { breedingRouter } from './breeding/routes';
import { hatcheryRouter } from './hatchery/routes';
import { feedRouter } from './feed/routes';
import { expenseRouter } from './finance/routes';
import { loanRouter, insuranceRouter, financeRouter } from './finance/loan.routes';
import { customerRouter, vendorRouter, invoiceRouter } from './invoices/routes';
import { orderRouter } from './sales/routes';
import { coldStorageRouter } from './cold/routes';
import { processingRouter, lotRouter } from './processing/routes';
import { dispatchRouter } from './dispatch/routes';
import { assetRouter } from './assets/routes';
import { byproductRouter } from './byproducts/routes';
import { weatherRouter, riskRouter } from './intelligence/routes';
import { marketRouter } from './market/routes';
import { alertRouter, dashboardRouter } from './notifications/routes';
import { reportRouter } from './reports/routes';
import { authLimiter } from './security/rate-limit';
import { auditWrite } from './security/audit';
import { prisma } from './prisma';
import { errorHandler } from './errors';

/**
 * CORS policy. When `WEB_ORIGIN` is set (comma-separated list, required before prod —
 * see docs/security-review.md), restrict cross-origin requests to that allowlist.
 * Unset (dev/test) falls back to the permissive default. Requests with no Origin header
 * (curl, server-to-server, same-origin) are always allowed.
 */
function corsOptions(): CorsOptions {
  const allow = (process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length === 0) return {};
  return {
    origin(origin, cb) {
      // Allow no-Origin (curl/server-to-server) and allowlisted origins. A disallowed
      // origin gets `false` (no ACAO header) rather than an error — the browser blocks it,
      // the server still responds cleanly without 500-ing.
      cb(null, !origin || allow.includes(origin));
    },
    credentials: true,
  };
}

/** Builds the Express app. Exported separately so tests can mount it without listening. */
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors(corsOptions()));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'ifm-api',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness: dependency health (DB) — 503 if a critical dependency is unreachable.
  app.get('/api/health/ready', async (_req, res) => {
    const checks: Record<string, boolean> = { db: false };
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = true;
    } catch {
      checks.db = false;
    }
    const ready = checks.db;
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable', checks });
  });

  // Brute-force protection on auth (no-op-ish under tests). Mounted before the auth router.
  app.use('/api/auth', authLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/me', meRouter);
  app.use('/api/me', profileRouter); // profile + sessions (slice 11.3)
  // Audit farm creation (POST /api/farms) and every successful mutation under /api/farm
  // (Brief §7). Mounted before the routers so it observes the whole subtree; it reads req
  // context after auth runs downstream. Note `/api/farm` does not match `/api/farms`.
  app.use('/api/farms', auditWrite);
  app.use('/api/farms', farmsRouter);
  app.use('/api/farm', auditWrite);
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
  app.use('/api/farm/health', healthRouter);
  app.use('/api/farm/breeding', breedingRouter);
  app.use('/api/farm/hatchery', hatcheryRouter);
  app.use('/api/farm/feed', feedRouter);
  app.use('/api/farm/expenses', expenseRouter);
  app.use('/api/farm/loans', loanRouter);
  app.use('/api/farm/insurance', insuranceRouter);
  app.use('/api/farm/finance', financeRouter);
  app.use('/api/farm/customers', customerRouter);
  app.use('/api/farm/vendors', vendorRouter);
  app.use('/api/farm/invoices', invoiceRouter);
  app.use('/api/farm/orders', orderRouter);
  app.use('/api/farm/coldstorage', coldStorageRouter);
  app.use('/api/farm/processing', processingRouter);
  app.use('/api/farm/lots', lotRouter);
  app.use('/api/farm/dispatches', dispatchRouter);
  app.use('/api/farm/assets', assetRouter);
  app.use('/api/farm/byproducts', byproductRouter);
  app.use('/api/farm/weather', weatherRouter);
  app.use('/api/farm/risk', riskRouter);
  app.use('/api/farm/market', marketRouter);
  app.use('/api/farm/alerts', alertRouter);
  app.use('/api/farm/dashboard', dashboardRouter);
  app.use('/api/farm/reports', reportRouter);

  // JSON 404 fallback — no dead ends, consistent error shape.
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
  });

  // Terminal error handler (after routes).
  app.use(errorHandler);

  return app;
}
