import { createApp } from './app';
import { env } from './env';
import { startTaskEngine } from './jobs/task-engine';
import { startReportEngine } from './jobs/report-engine';
import { startIntelligenceEngine } from './jobs/intelligence-engine';

const app = createApp();

app.listen(env.API_PORT, () => {
  console.log(`[ifm-api] listening on http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
});

// Recurring schedulers (BullMQ/Redis). No-op without REDIS_URL.
if (env.NODE_ENV !== 'test') {
  try {
    startTaskEngine();
  } catch (err) {
    console.error('[task-engine] failed to start', err);
  }
  try {
    startReportEngine();
  } catch (err) {
    console.error('[report-engine] failed to start', err);
  }
  try {
    startIntelligenceEngine();
  } catch (err) {
    console.error('[intelligence-sweep] failed to start', err);
  }
}
