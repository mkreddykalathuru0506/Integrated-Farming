import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password';

describe('password hashing (argon2)', () => {
  it('hashes then verifies a correct password', async () => {
    const hash = await hashPassword('S3cretPass!');
    expect(hash).not.toBe('S3cretPass!');
    expect(await verifyPassword(hash, 'S3cretPass!')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('S3cretPass!');
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });
});
