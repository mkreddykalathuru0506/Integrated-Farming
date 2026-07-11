import { Router, type Request } from 'express';
import { asyncHandler } from '../errors';
import {
  ChangePasswordSchema,
  ForgotSchema,
  LoginSchema,
  LogoutSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  RefreshSchema,
  RegisterSchema,
  ResetSchema,
} from './schemas';
import * as auth from './service';
import { requestOtp, OTP_RESEND_COOLDOWN_SEC } from './otp';
import { requireAuth } from './middleware';
import { otpRequestLimiter } from '../security/rate-limit';

export const authRouter = Router();

/** Request metadata recorded on new sessions (device list in /api/me/sessions). */
function sessionMeta(req: Request): auth.SessionMeta {
  return { ip: req.ip, userAgent: req.header('user-agent')?.slice(0, 512) };
}

/**
 * The one and only response for OTP issuance — returned whether or not the account
 * exists, whether or not a code was actually created (cooldown). Byte-identical in
 * every case so the endpoint cannot be used to enumerate accounts.
 */
const OTP_GENERIC_RESPONSE = { ok: true, retryAfterSec: OTP_RESEND_COOLDOWN_SEC };

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
    res.status(200).json(await auth.login(input, sessionMeta(req)));
  }),
);

authRouter.post(
  '/otp/request',
  otpRequestLimiter,
  asyncHandler(async (req, res) => {
    const input = OtpRequestSchema.parse(req.body);
    await requestOtp(input.email, input.purpose);
    res.status(200).json(OTP_GENERIC_RESPONSE);
  }),
);

authRouter.post(
  '/otp/verify',
  asyncHandler(async (req, res) => {
    const input = OtpVerifySchema.parse(req.body);
    res.status(200).json(await auth.otpLogin(input.email, input.code, sessionMeta(req)));
  }),
);

authRouter.post(
  '/forgot',
  otpRequestLimiter,
  asyncHandler(async (req, res) => {
    const input = ForgotSchema.parse(req.body);
    await requestOtp(input.email, 'RESET_PASSWORD');
    res.status(200).json(OTP_GENERIC_RESPONSE);
  }),
);

authRouter.post(
  '/reset',
  asyncHandler(async (req, res) => {
    const input = ResetSchema.parse(req.body);
    await auth.resetPassword(input.email, input.code, input.newPassword, req.ip);
    res.status(200).json({ ok: true });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = ChangePasswordSchema.parse(req.body);
    await auth.changePassword(req.userId!, input, req.ip);
    res.status(200).json({ ok: true });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = RefreshSchema.parse(req.body);
    res.status(200).json(await auth.refresh(refreshToken, sessionMeta(req)));
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
