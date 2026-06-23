import { createApp } from './app';
import { env } from './env';
import { startTaskEngine } from './jobs/task-engine';

const app = createApp();

app.listen(env.API_PORT, () => {
  console.log(`[ifm-api] listening on http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
});

// Recurring task generator (BullMQ/Redis). No-op without REDIS_URL.
if (env.NODE_ENV !== 'test') {
  try {
    startTaskEngine();
  } catch (err) {
    console.error('[task-engine] failed to start', err);
  }
}
