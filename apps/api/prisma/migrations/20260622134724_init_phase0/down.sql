-- Manual DOWN for prod rollback safety (Prisma migrations are forward-only).
-- Dev rollback: `pnpm db:reset`. Prod: take a backup first, then apply this at a checkpoint.
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "Membership" CASCADE;
DROP TABLE IF EXISTS "Unit" CASCADE;
DROP TABLE IF EXISTS "FarmSetting" CASCADE;
DROP TABLE IF EXISTS "Farm" CASCADE;
DROP TABLE IF EXISTS "RefreshToken" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TYPE IF EXISTS "FssaiTier";
DROP TYPE IF EXISTS "MembershipStatus";
DROP TYPE IF EXISTS "UnitType";
DROP TYPE IF EXISTS "Role";
