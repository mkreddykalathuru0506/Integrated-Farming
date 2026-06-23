import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enqueue, flush, pendingCount, enqueueAndFlush, __clearQueue, type QueuedLog } from './queue';

const item = (id: string): QueuedLog => ({ clientLogId: id, type: 'FEED', batchId: 'b1', quantity: 10, unit: 'kg' });

describe('offline log queue', () => {
  beforeEach(async () => {
    await __clearQueue();
  });

  it('keeps items when posting fails (offline)', async () => {
    await enqueue(item('a'));
    const failing = vi.fn().mockRejectedValue(new Error('offline'));
    const sent = await flush(failing);
    expect(sent).toBe(0);
    expect(await pendingCount()).toBe(1);
  });

  it('drains items when posting succeeds (back online)', async () => {
    await enqueue(item('a'));
    const ok = vi.fn().mockResolvedValue(undefined);
    const sent = await flush(ok);
    expect(sent).toBe(1);
    expect(await pendingCount()).toBe(0);
  });

  it('is idempotent: same clientLogId never duplicates in the queue', async () => {
    await enqueue(item('dup'));
    await enqueue(item('dup'));
    expect(await pendingCount()).toBe(1);
  });

  it('enqueueAndFlush retains on failure, then a later flush syncs it', async () => {
    const fail = vi.fn().mockRejectedValue(new Error('offline'));
    await enqueueAndFlush(item('x'), fail);
    expect(await pendingCount()).toBe(1);

    const ok = vi.fn().mockResolvedValue(undefined);
    await flush(ok);
    expect(await pendingCount()).toBe(0);
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
