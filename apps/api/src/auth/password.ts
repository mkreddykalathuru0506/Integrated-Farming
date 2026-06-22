import { hash, verify } from '@node-rs/argon2';

/** Hash a plaintext password with Argon2id (prebuilt binaries, no native compile). */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

/** Verify a plaintext password against a stored hash. Returns false on any error. */
export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}
