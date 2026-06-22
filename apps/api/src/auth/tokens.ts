import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../env';

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

/** Sign a short-lived access JWT (HS256) with the user id as subject. */
export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TTL)
    .sign(accessKey);
}

/** Verify an access JWT; returns the subject (user id) or throws. */
export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, accessKey);
  if (!payload.sub) throw new Error('Token missing subject');
  return payload.sub;
}

/** Create an opaque refresh token + its SHA-256 hash (the hash is what we store). */
export function createRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: sha256(token) };
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
