import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { isApiError } from '../lib/http';

export type QueueStatus = 'pending' | 'failed';

/**
 * A daily-log write waiting to be synced. Keyed by clientLogId (idempotent).
 * `farmId` scopes the item so a flush only ever posts logs for the farm that is
 * currently selected (X-Farm-Id must match, or the server rejects with 422).
 * `status: 'failed'` parks a permanently-rejected (4xx) item so it neither retries
 * forever nor blocks newer logs behind it — the user discards it explicitly.
 */
export type QueuedLog = {
  clientLogId: string;
  farmId: string;
  type: string;
  batchId?: string;
  quantity: number;
  unit: string;
  status?: QueueStatus;
};

interface OfflineDB extends DBSchema {
  logQueue: { key: string; value: QueuedLog };
}

const DB_NAME = 'ifm-offline';
const DB_VERSION = 2;
let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(d, oldVersion) {
        // v2 introduces the required `farmId` (farm-scoping). Pre-v2 rows carry no
        // farm and cannot be safely attributed to one, so drop them rather than risk
        // posting a Farm A log under Farm B's X-Farm-Id.
        if (oldVersion < 2 && d.objectStoreNames.contains('logQueue')) {
          d.deleteObjectStore('logQueue');
        }
        if (!d.objectStoreNames.contains('logQueue')) {
          d.createObjectStore('logQueue', { keyPath: 'clientLogId' });
        }
      },
    });
  }
  return dbPromise;
}

/** Posts one queued item; must reject on failure so we can classify + keep/park it. */
export type Poster = (item: QueuedLog) => Promise<void>;

export async function enqueue(item: QueuedLog): Promise<void> {
  const d = await db();
  await d.put('logQueue', item); // keyPath dedups on clientLogId
}

/** Count of pending (not failed) items, scoped to a farm when given. */
export async function pendingCount(farmId?: string): Promise<number> {
  const d = await db();
  const items = await d.getAll('logQueue');
  return items.filter((i) => i.status !== 'failed' && (!farmId || i.farmId === farmId)).length;
}

/** Permanently-failed items (4xx) for a farm — surfaced so the user can discard them. */
export async function failedItems(farmId?: string): Promise<QueuedLog[]> {
  const d = await db();
  const items = await d.getAll('logQueue');
  return items.filter((i) => i.status === 'failed' && (!farmId || i.farmId === farmId));
}

export type FlushResult = { sent: number; failed: number };

/**
 * Try to send queued items for `farmId` in order.
 * - success → drop the item;
 * - permanent client error (4xx, e.g. 422 INVALID_TARGET) → mark it `failed` and
 *   CONTINUE, so a poisoned item never blocks every newer log behind it;
 * - network / 5xx → keep the item and STOP (offline semantics — retry later).
 * Items belonging to other farms and already-failed items are never touched.
 */
export async function flush(post: Poster, farmId?: string): Promise<FlushResult> {
  const d = await db();
  const items = (await d.getAll('logQueue')).filter(
    (i) => i.status !== 'failed' && (!farmId || i.farmId === farmId),
  );
  let sent = 0;
  let failed = 0;
  for (const item of items) {
    try {
      await post(item);
      await d.delete('logQueue', item.clientLogId);
      sent += 1;
    } catch (err) {
      if (isApiError(err) && err.status >= 400 && err.status < 500) {
        await d.put('logQueue', { ...item, status: 'failed' }); // park the poison, keep going
        failed += 1;
        continue;
      }
      break; // offline / server unreachable — keep the rest, retry later
    }
  }
  return { sent, failed };
}

/** Persist then immediately attempt to sync just this farm's items (no-throw). */
export async function enqueueAndFlush(item: QueuedLog, post: Poster): Promise<void> {
  await enqueue(item);
  await flush(post, item.farmId).catch(() => undefined);
}

/** Discard one item by id (used to clear a permanently-failed entry). */
export async function discard(clientLogId: string): Promise<void> {
  const d = await db();
  await d.delete('logQueue', clientLogId);
}

/** Clear the whole queue — called on logout so nothing leaks into the next user. */
export async function clearQueue(): Promise<void> {
  const d = await db();
  await d.clear('logQueue');
}

/** Test helper alias for {@link clearQueue}. */
export const __clearQueue = clearQueue;
