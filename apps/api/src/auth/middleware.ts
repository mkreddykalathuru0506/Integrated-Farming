import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { verifyAccessToken } from './tokens';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      farmId?: string;
      role?: Role;
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

/**
 * Resolve farm context from the `X-Farm-Id` header and authorize it against the
 * caller's ACTIVE membership. Sets req.farmId + req.role. Must run after requireAuth.
 * This is the no-IDOR / no cross-farm-leak guard for every /api/farm/* route.
 */
export async function requireFarmAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.userId) throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
    const farmId = req.header('x-farm-id');
    if (!farmId) throw new AppError(400, 'FARM_REQUIRED', 'Missing X-Farm-Id header');

    const membership = await prisma.membership.findUnique({
      where: { userId_farmId: { userId: req.userId, farmId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError(403, 'FORBIDDEN', 'No access to this farm');
    }

    req.farmId = farmId;
    req.role = membership.role;
    next();
  } catch (err) {
    next(err);
  }
}

/** Gate a route to specific roles. Must run after requireFarmAccess. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.role || !roles.includes(req.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Insufficient role'));
    }
    next();
  };
}
