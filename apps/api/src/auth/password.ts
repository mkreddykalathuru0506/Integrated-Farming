import { hash, verify, type Options } from '@node-rs/argon2';

// In tests we hash hundreds of times in one process — use cheap Argon2 params so
// the single-fork worker doesn't exhaust memory. Production uses the secure defaults.
// (verify() reads params from the stored hash, so test hashes verify fine.)
const TEST_OPTS: Options = { memoryCost: 512, timeCost: 1, parallelism: 1 };
const opts = process.env.NODE_ENV === 'test' ? TEST_OPTS : undefined;

/** Hash a plaintext password with Argon2id (prebuilt binaries, no native compile). */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain, opts);
}

/** Verify a plaintext password against a stored hash. Returns false on any error. */
export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}
