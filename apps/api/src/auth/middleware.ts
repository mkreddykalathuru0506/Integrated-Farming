import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
import { verifyAccessToken } from './tokens';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/** Require a valid `Authorization: Bearer <accessToken>`; sets req.userId. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing bearer token');
    }
    req.userId = await verifyAccessToken(token);
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
}
