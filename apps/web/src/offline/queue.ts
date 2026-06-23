import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/** A daily-log write waiting to be synced. Keyed by clientLogId (idempotent). */
export type QueuedLog = {
  clientLogId: string;
  type: string;
  batchId?: string;
  quantity: number;
  unit: string;
};

interface OfflineDB extends DBSchema {
  logQueue: { key: string; value: QueuedLog };
}

const DB_NAME = 'ifm-offline';
let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('logQueue')) {
          d.createObjectStore('logQueue', { keyPath: 'clientLogId' });
        }
      },
    });
  }
  return dbPromise;
}

/** Posts one queued item; must reject on network/offline failure so we keep it. */
export type Poster = (item: QueuedLog) => Promise<void>;

export async function enqueue(item: QueuedLog): Promise<void> {
  const d = await db();
  await d.put('logQueue', item); // keyPath dedups on clientLogId
}

export async function pendingCount(): Promise<number> {
  const d = await db();
  return d.count('logQueue');
}

/** Try to send queued items in order; drop each on success, stop on first failure. */
export async function flush(post: Poster): Promise<number> {
  const d = await db();
  const items = await d.getAll('logQueue');
  let sent = 0;
  for (const item of items) {
    try {
      await post(item);
      await d.delete('logQueue', item.clientLogId);
      sent += 1;
    } catch {
      break; // offline / server unreachable — keep the rest, retry later
    }
  }
  return sent;
}

/** Persist then immediately attempt to sync (no-throw). */
export async function enqueueAndFlush(item: QueuedLog, post: Poster): Promise<void> {
  await enqueue(item);
  await flush(post).catch(() => undefined);
}

/** Test helper: clear the queue. */
export async function __clearQueue(): Promise<void> {
  const d = await db();
  await d.clear('logQueue');
}
