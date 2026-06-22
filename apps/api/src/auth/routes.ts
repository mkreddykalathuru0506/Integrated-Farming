import { Router } from 'express';
import { asyncHandler } from '../errors';
import { LoginSchema, LogoutSchema, RefreshSchema, RegisterSchema } from './schemas';
import * as auth from './service';
import { requireAuth } from './middleware';

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = RegisterSchema.parse(req.body);
    const user = await auth.register(input);
    res.status(201).json({ user });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = LoginSchema.parse(req.body);
    res.status(200).json(await auth.login(input, req.ip));
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = RefreshSchema.parse(req.body);
    res.status(200).json(await auth.refresh(refreshToken));
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = LogoutSchema.parse(req.body);
    await auth.logout(refreshToken);
    res.status(200).json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.status(200).json({ user: await auth.getMe(req.userId!) });
  }),
);
