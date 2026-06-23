-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "FeedTransaction" CASCADE;
DROP TABLE IF EXISTS "FeedItem" CASCADE;
DROP TYPE IF EXISTS "FeedTxnType";
