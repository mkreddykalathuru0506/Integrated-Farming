import { z } from 'zod';

/** Assignable membership roles (mirrors the Prisma `Role` enum). */
export const RoleEnum = z.enum([
  'OWNER',
  'MANAGER',
  'VETERINARIAN',
  'ACCOUNTANT',
  'LABOUR',
  'BUYER',
]);

/** POST /api/farm/members — attach an EXISTING user by email (v1: no invites). */
export const AddMemberSchema = z.object({
  email: z.string().trim().email().max(160),
  role: RoleEnum,
});
export type AddMemberInput = z.infer<typeof AddMemberSchema>;

/** PATCH /api/farm/members/:userId — change a member's role. */
export const ChangeRoleSchema = z.object({ role: RoleEnum });
export type ChangeRoleInput = z.infer<typeof ChangeRoleSchema>;
