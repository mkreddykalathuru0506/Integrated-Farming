import { z } from 'zod';

/**
 * Shared additive-pagination query contract (slice 11.5a).
 *
 * - `page` absent → the endpoint keeps its byte-for-byte legacy response
 *   (same legacy key, ordering and limits). Filters still apply when given.
 * - `page` present → `{ items, total, page, pageSize }` envelope where `items`
 *   carries exactly the same DTO shape as the legacy list elements.
 *
 * Endpoints extend this schema per entity (e.g. `status: z.nativeEnum(BatchStatus)`)
 * so an invalid enum value is a 400 VALIDATION, never a Prisma error.
 */
export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(80).optional(),
  status: z.string().trim().max(30).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListQuery = z.infer<typeof ListQuerySchema>;

type Paging = Pick<ListQuery, 'page' | 'pageSize'>;

/** Prisma skip/take for a paged request. Callers only invoke this when `page` is set. */
export const skipTake = (p: Paging) => ({ skip: (p.page! - 1) * p.pageSize, take: p.pageSize });

/** The paged response envelope. `total` counts all rows matching the filters. */
export const envelope = <T>(items: T[], total: number, p: Paging) => ({
  items,
  total,
  page: p.page!,
  pageSize: p.pageSize,
});

/** gte/lte bound for a date column, or undefined when neither end is given. */
export const dateRange = (from?: Date, to?: Date) =>
  from || to ? { gte: from, lte: to } : undefined;

/** Case-insensitive contains filter for `q` searches. */
export const contains = (q: string) => ({ contains: q, mode: 'insensitive' as const });
