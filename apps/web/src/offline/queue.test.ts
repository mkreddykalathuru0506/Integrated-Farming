import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enqueue,
  failedItems,
  flush,
  pendingCount,
  enqueueAndFlush,
  discard,
  __clearQueue,
  type QueuedLog,
} from './queue';
import { ApiError } from '../lib/http';

const item = (id: string, farmId = 'f1'): QueuedLog => ({
  clientLogId: id,
  farmId,
  type: 'FEED',
  batchId: 'b1',
  quantity: 10,
  unit: 'kg',
});

describe('offline log queue', () => {
  beforeEach(async () => {
    await __clearQueue();
  });

  it('keeps items when posting fails (offline)', async () => {
    await enqueue(item('a'));
    const failing = vi.fn().mockRejectedValue(new Error('offline'));
    const { sent } = await flush(failing, 'f1');
    expect(sent).toBe(0);
    expect(await pendingCount('f1')).toBe(1);
  });

  it('drains items when posting succeeds (back online)', async () => {
    await enqueue(item('a'));
    const ok = vi.fn().mockResolvedValue(undefined);
    const { sent } = await flush(ok, 'f1');
    expect(sent).toBe(1);
    expect(await pendingCount('f1')).toBe(0);
  });

  it('is idempotent: same clientLogId never duplicates in the queue', async () => {
    await enqueue(item('dup'));
    await enqueue(item('dup'));
    expect(await pendingCount('f1')).toBe(1);
  });

  it('enqueueAndFlush retains on failure, then a later flush syncs it', async () => {
    const fail = vi.fn().mockRejectedValue(new Error('offline'));
    await enqueueAndFlush(item('x'), fail);
    expect(await pendingCount('f1')).toBe(1);

    const ok = vi.fn().mockResolvedValue(undefined);
    await flush(ok, 'f1');
    expect(await pendingCount('f1')).toBe(0);
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('flush is farm-scoped: only posts items for the current farm', async () => {
    await enqueue(item('a', 'fA'));
    await enqueue(item('b', 'fB'));
    const posted: string[] = [];
    const ok = vi.fn(async (i: QueuedLog) => {
      posted.push(i.clientLogId);
    });

    const rA = await flush(ok, 'fA');
    expect(rA.sent).toBe(1);
    expect(posted).toEqual(['a']);
    // Farm B's item is untouched and still pending under its own scope.
    expect(await pendingCount('fB')).toBe(1);
    expect(await pendingCount('fA')).toBe(0);
  });

  it('parks a permanent 4xx as failed and CONTINUES past it (no poison blocking)', async () => {
    await enqueue(item('poison'));
    await enqueue(item('good'));
    const posted: string[] = [];
    const post = vi.fn(async (i: QueuedLog) => {
      if (i.clientLogId === 'poison') throw new ApiError(422, 'INVALID_TARGET', 'wrong farm');
      posted.push(i.clientLogId);
    });

    const { sent, failed } = await flush(post, 'f1');
    expect(sent).toBe(1); // 'good' still synced
    expect(failed).toBe(1); // 'poison' parked
    expect(posted).toEqual(['good']);
    // The poison is now a surfaced failed item, out of the pending count.
    expect(await pendingCount('f1')).toBe(0);
    const failedRows = await failedItems('f1');
    expect(failedRows.map((r) => r.clientLogId)).toEqual(['poison']);
  });

  it('a network/5xx failure keeps the item and STOPS (offline semantics)', async () => {
    await enqueue(item('first'));
    await enqueue(item('second'));
    const post = vi.fn(async () => {
      throw new ApiError(0, 'NETWORK', 'offline');
    });
    const { sent, failed } = await flush(post, 'f1');
    expect(sent).toBe(0);
    expect(failed).toBe(0);
    expect(await pendingCount('f1')).toBe(2); // both kept for a later retry
  });

  it('discard removes a parked failed item', async () => {
    await enqueue({ ...item('gone'), status: 'failed' });
    expect((await failedItems('f1')).length).toBe(1);
    await discard('gone');
    expect((await failedItems('f1')).length).toBe(0);
  });
});
