import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../env';
import { allFarmIds, generateDueTasks, sweepMissed } from '../tasks/engine';

const QUEUE = 'task-engine';

/**
 * Starts the recurring task generator on BullMQ/Redis: every day at 05:00 it
 * generates due tasks + sweeps missed ones across all farms. No-op without REDIS_URL.
 * The same generator is exposed via POST /api/farm/tasks/generate for on-demand use.
 */
export function startTaskEngine(): void {
  if (!env.REDIS_URL) {
    console.log('[task-engine] REDIS_URL not set — scheduler disabled');
    return;
  }
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE, { connection });

  void queue.add(
    'daily',
    {},
    { repeat: { pattern: '0 5 * * *' }, jobId: 'daily-generate', removeOnComplete: true, removeOnFail: 100 },
  );

  new Worker(
    QUEUE,
    async () => {
      const now = new Date();
      for (const farmId of await allFarmIds()) {
        await generateDueTasks(farmId, now);
        await sweepMissed(farmId, now);
      }
    },
    { connection },
  );

  console.log('[task-engine] scheduler started (daily 05:00)');
}
