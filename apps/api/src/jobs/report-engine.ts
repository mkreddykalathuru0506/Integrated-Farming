import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../env';
import { runDueReports } from '../reports/schedule.service';

const QUEUE = 'report-engine';

/**
 * Starts the recurring report deliverer on BullMQ/Redis: every day at 06:00 it runs any
 * report schedules whose nextRunAt has passed and delivers them via NotificationService
 * (mock by default → no spend). No-op without REDIS_URL. Same sweep is exposed per-schedule
 * via POST /api/farm/reports/schedules/:id/run for on-demand use.
 */
export function startReportEngine(): void {
  if (!env.REDIS_URL) {
    console.log('[report-engine] REDIS_URL not set — scheduler disabled');
    return;
  }
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE, { connection });

  void queue.add(
    'daily',
    {},
    { repeat: { pattern: '0 6 * * *' }, jobId: 'daily-reports', removeOnComplete: true, removeOnFail: 100 },
  );

  new Worker(
    QUEUE,
    async () => {
      await runDueReports(new Date());
    },
    { connection },
  );

  console.log('[report-engine] scheduler started (daily 06:00)');
}
