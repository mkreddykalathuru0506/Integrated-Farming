import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { globalSearch } from './service';

const SearchQuerySchema = z.object({ q: z.string().trim().min(2).max(60) });

/**
 * /api/farm/search — global search (read-only; any ACTIVE member).
 * Every sub-query is farm-scoped: search reveals nothing a member read couldn't
 * already fetch from the list endpoints (all lists are member-readable today).
 */
export const searchRouter = Router();
searchRouter.use(requireAuth, requireFarmAccess);

searchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q } = SearchQuerySchema.parse(req.query);
    res.json(await globalSearch(farmScope(req).farmId, q));
  }),
);
