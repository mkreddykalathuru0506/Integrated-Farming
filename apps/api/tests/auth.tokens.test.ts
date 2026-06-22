import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../src/auth/tokens';

describe('access tokens (jose)', () => {
  it('signs and verifies, returning the subject', async () => {
    const token = await signAccessToken('user-123');
    expect(await verifyAccessToken(token)).toBe('user-123');
  });

  it('rejects a tampered token', async () => {
    const token = await signAccessToken('user-123');
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa');
    await expect(verifyAccessToken(tampered)).rejects.toBeTruthy();
  });
});
