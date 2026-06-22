/** RBAC roles (mirror of the Prisma `Role` enum). Brief §2. */
export const ROLES = [
  'OWNER',
  'MANAGER',
  'VETERINARIAN',
  'ACCOUNTANT',
  'LABOUR',
  'BUYER',
] as const;
export type Role = (typeof ROLES)[number];

/** Farm unit types (mirror of the Prisma `UnitType` enum). Brief §4.1. */
export const UNIT_TYPES = [
  'POULTRY',
  'CATTLE',
  'GOATERY',
  'RABBITRY',
  'MUSHROOM_HOUSE',
  'HATCHERY',
  'FROZEN_STORE',
  'NURSERY',
  'BIOGAS',
  'OTHER',
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];
