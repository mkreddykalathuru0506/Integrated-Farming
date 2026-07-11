-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "OtpToken" CASCADE;
DROP TYPE IF EXISTS "OtpPurpose";
ALTER TABLE "RefreshToken" DROP COLUMN IF EXISTS "ip";
ALTER TABLE "RefreshToken" DROP COLUMN IF EXISTS "userAgent";
ALTER TABLE "RefreshToken" DROP COLUMN IF EXISTS "lastUsedAt";
