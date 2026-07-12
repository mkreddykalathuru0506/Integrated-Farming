import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../env';
import { sweepAllFarms } from '../intelligence/service';

const QUEUE = 'intelligence-sweep';

/**
 * Proactive intelligence sweep on BullMQ/Redis: every day at 05:30 IST it fetches weather
 * for every farm with a location set (daily-cached; mock unless WEATHER_PROVIDER is
 * configured), upserts THI/heat-stress risk flags, and routes alerts for new CRITICAL
 * flags via the idempotent dispatcher. No-op without REDIS_URL. The same sweep is exposed
 * per-farm via POST /api/farm/intelligence/sweep for on-demand use (demos, web Refresh).
 */
export function startIntelligenceEngine(): void {
  if (!env.REDIS_URL) {
    console.log('[intelligence-sweep] REDIS_URL not set — scheduler disabled');
    return;
  }
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE, { connection });

  void queue.add(
    'daily',
    {},
    {
      repeat: { pattern: '30 5 * * *', tz: 'Asia/Kolkata' },
      jobId: 'daily-sweep',
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );

  new Worker(
    QUEUE,
    async () => {
      const summary = await sweepAllFarms();
      console.log(
        `[intelligence-sweep] farms=${summary.farms} swept=${summary.swept} dispatched=${summary.dispatched} failed=${summary.failed}`,
      );
    },
    { connection },
  );

  console.log('[intelligence-sweep] scheduler started (daily 05:30 IST)');
}
