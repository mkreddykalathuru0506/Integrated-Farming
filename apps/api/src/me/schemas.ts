import { z } from 'zod';

/** PATCH /api/me — partial profile update. Email is immutable here by design. */
export const UpdateMeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9]{8,15}$/, 'Phone must be 8-15 digits, optionally prefixed with +')
    .optional(),
  locale: z.string().min(2).max(10).optional(),
});

export const RevokeOthersSchema = z.object({ refreshToken: z.string().min(1) });

export type UpdateMeInput = z.infer<typeof UpdateMeSchema>;
