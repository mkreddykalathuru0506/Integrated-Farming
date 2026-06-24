import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

/** HTTP methods that mutate state and therefore must be audited. */
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Default action verbs by method when the route has no trailing named action. */
const VERB: Record<string, string> = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

/**
 * A path segment is treated as an entity id (vs. a named resource/action) when it
 * is long + id-shaped. Prisma `cuid()` ids are 25 chars; route words ("advance",
 * "circularity", "summary.pdf") are short, so a length threshold separates them cleanly.
 */
function isIdSegment(seg: string): boolean {
  return seg.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(seg);
}

/** Best-effort client IP, honouring a single reverse-proxy hop (nginx) via X-Forwarded-For. */
export function clientIp(req: Request): string | undefined {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  return (first?.trim() || req.socket.remoteAddress) ?? undefined;
}

/** Pull a created/affected entity id out of a JSON response body, if present. */
function idFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const obj = body as Record<string, unknown>;
  if (typeof obj.id === 'string') return obj.id;
  // Many handlers nest the resource, e.g. { batch: { id } } or { data: { id } }.
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && typeof (v as Record<string, unknown>).id === 'string') {
      return (v as Record<string, string>).id;
    }
  }
  return undefined;
}

/**
 * Derive { action, entity, entityId } from the mount-relative sub-path, e.g.
 * "/batches/<id>/advance" → { action: "batches.advance", entity: "Batches", entityId: <id> }.
 * The empty sub-path "/" (a write straight to the mount root, e.g. POST /api/farms) maps to
 * the "farm" resource.
 */
function describe(
  method: string,
  subPath: string,
  body: unknown,
): { action: string; entity: string; entityId?: string } {
  const segs = subPath.split('/').filter(Boolean);
  const named = segs.filter((s) => !isIdSegment(s)); // e.g. ["batches", "advance"]
  const resource = named[0] ?? 'farm';
  const tail = named.slice(1); // named sub-action(s), e.g. ["advance"]
  const verb = tail.length ? tail[tail.length - 1] : VERB[method] ?? method.toLowerCase();
  const action = tail.length ? named.join('.') : `${resource}.${verb}`;
  const entity = resource.charAt(0).toUpperCase() + resource.slice(1);
  const entityId = segs.find(isIdSegment) ?? idFromBody(body);
  return { action, entity, entityId };
}

/**
 * Audit middleware for mutating /api/farm/* routes (Brief §7: "audit log table on every write").
 * Records one AuditLog row per *successful* mutation (2xx), capturing who/what/where without
 * touching any route handler. Mount once at the /api/farm base, before the sub-routers; it runs
 * downstream auth so req.userId/farmId are populated by the time the response finishes.
 * Audit failures never break the request — logging is best-effort and isolated.
 */
export function auditWrite(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING.has(req.method)) return next();

  // Capture the mount-relative path NOW: Express restores req.url to the full path once the
  // request unwinds, so reading it inside the deferred finish handler would be wrong.
  const subPath = req.path;
  const method = req.method;

  // Capture the JSON body so we can recover a created resource's id for entityId.
  let captured: unknown;
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    captured = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return; // only successful writes
    const { action, entity, entityId } = describe(method, subPath, captured);
    void prisma.auditLog
      .create({
        data: {
          farmId: req.farmId ?? null,
          userId: req.userId ?? null,
          action,
          entity,
          entityId: entityId ?? null,
          ip: clientIp(req),
        },
      })
      .catch(() => {
        /* never let an audit write failure affect the served request */
      });
  });

  next();
}
