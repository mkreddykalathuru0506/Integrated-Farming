import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireRole } from '../src/auth/middleware';
import { AppError } from '../src/errors';

const fakeReq = (role?: string) => ({ role }) as unknown as Request;

describe('requireRole', () => {
  it('calls next() with no error for a permitted role', () => {
    const next = vi.fn();
    requireRole('OWNER', 'MANAGER')(fakeReq('OWNER'), {} as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
  });

  it('blocks a disallowed role with 403 FORBIDDEN', () => {
    const next = vi.fn();
    requireRole('OWNER')(fakeReq('LABOUR'), {} as Response, next as unknown as NextFunction);
    const err = next.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(403);
    expect((err as AppError).code).toBe('FORBIDDEN');
  });

  it('blocks when no role is present', () => {
    const next = vi.fn();
    requireRole('OWNER')(fakeReq(undefined), {} as Response, next as unknown as NextFunction);
    expect((next.mock.calls[0]?.[0] as AppError).status).toBe(403);
  });
});
