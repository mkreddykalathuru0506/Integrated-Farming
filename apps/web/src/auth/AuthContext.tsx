import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { resetRequestFetch, setRequestFetch } from '../lib/http';
import { clearQueue } from '../offline/queue';
import {
  changePasswordRequest,
  loginRequest,
  logoutRequest,
  otpVerifyRequest,
  refreshRequest,
  revokeOtherSessionsRequest,
  type PublicUser,
  type Session,
} from './api';

const RT_KEY = 'ifm.auth.rt';

function readStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(RT_KEY);
  } catch {
    return null;
  }
}

function writeStoredRefreshToken(rt: string | null) {
  try {
    if (rt === null) localStorage.removeItem(RT_KEY);
    else localStorage.setItem(RT_KEY, rt);
  } catch {
    /* ignore storage failures (private mode) */
  }
}

type AuthState = {
  user: PublicUser | null;
  accessToken: string | null;
  /**
   * RefreshToken row id of THIS session (from login/refresh/otp-verify responses,
   * slice 11.3 API) — lets the sessions list mark "this device". Null on older APIs.
   */
  sessionId: string | null;
  /** True while a persisted session is being restored on boot. */
  restoring: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Passwordless login: verify an emailed 6-digit LOGIN code. */
  loginWithOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Sync the in-memory user after a profile update (PATCH /api/me). */
  updateUser: (user: PublicUser) => void;
  /**
   * Change the password; the API revokes every OTHER session (the presenting
   * refresh token — this one — stays valid).
   */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Revoke every session except this one. Resolves to the revoked count. */
  revokeOtherSessions: () => Promise<number>;
  /**
   * fetch wrapper used (via the http delegate) by every API call: injects the
   * current access token and, on 401, performs ONE single-flight refresh and
   * replays the original request once. Refresh failure → global logout.
   */
  authedFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(() => readStoredRefreshToken() !== null);

  // Refs mirror the tokens so the stable authedFetch closure always sees the
  // current values (no re-created fetch delegate per render).
  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(readStoredRefreshToken());
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const applySession = useCallback((session: Session) => {
    accessRef.current = session.accessToken;
    refreshRef.current = session.refreshToken;
    writeStoredRefreshToken(session.refreshToken);
    setAccessToken(session.accessToken);
    setSessionId(session.sessionId ?? null);
    setUser(session.user);
  }, []);

  const clearSession = useCallback(() => {
    accessRef.current = null;
    refreshRef.current = null;
    writeStoredRefreshToken(null);
    setAccessToken(null);
    setSessionId(null);
    setUser(null);
    // Drop cached farm data so nothing leaks into the next signed-in user.
    queryClient.clear();
    // Also drop any queued offline daily-log writes (no-throw; idb may be absent).
    void clearQueue().catch(() => undefined);
  }, [queryClient]);

  /**
   * Single-flight refresh: concurrent 401s share one in-flight request.
   * Resolves to the rotated access token, or null after a terminal failure
   * (in which case the session has already been cleared).
   */
  const refreshSession = useCallback((): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const rt = refreshRef.current;
    if (!rt) return Promise.resolve(null);
    const inFlight = refreshRequest(rt)
      .then((session) => {
        applySession(session);
        return session.accessToken;
      })
      .catch(() => {
        clearSession();
        return null;
      })
      .finally(() => {
        refreshInFlight.current = null;
      });
    refreshInFlight.current = inFlight;
    return inFlight;
  }, [applySession, clearSession]);

  const authedFetch = useCallback(
    async (input: string, init?: RequestInit): Promise<Response> => {
      const send = (token: string | null) => {
        const headers = new Headers(init?.headers);
        // The live token wins over whatever the caller closured (it may be stale
        // after a rotation); callers without a token get it injected here.
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      };
      const res = await send(accessRef.current);
      if (res.status !== 401 || !refreshRef.current) return res;
      const rotated = await refreshSession();
      if (!rotated) return res; // refresh failed → global logout already done
      return send(rotated);
    },
    [refreshSession],
  );

  // Install authedFetch as the http-core delegate so EVERY request() call
  // (legacy token-threaded helpers included) gets injection + 401 replay.
  useLayoutEffect(() => {
    setRequestFetch(authedFetch);
    return () => resetRequestFetch();
  }, [authedFetch]);

  // Boot: restore the persisted session via one silent refresh.
  const bootRan = useRef(false);
  useEffect(() => {
    if (bootRan.current) return; // StrictMode double-mount guard
    bootRan.current = true;
    if (!refreshRef.current) {
      setRestoring(false);
      return;
    }
    void refreshSession().finally(() => setRestoring(false));
  }, [refreshSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      applySession(await loginRequest(email, password));
    },
    [applySession],
  );

  const loginWithOtp = useCallback(
    async (email: string, code: string) => {
      applySession(await otpVerifyRequest(email, code));
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const rt = refreshRef.current;
    if (rt) await logoutRequest(rt).catch(() => undefined);
    clearSession();
  }, [clearSession]);

  const updateUser = useCallback((next: PublicUser) => setUser(next), []);

  // The refresh token never leaves this provider: endpoints that must identify
  // the presenting session (change-password, revoke-others) are wrapped here.
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const refreshToken = refreshRef.current;
    if (!refreshToken) throw new Error('Not authenticated');
    await changePasswordRequest({ currentPassword, newPassword, refreshToken });
  }, []);

  const revokeOtherSessions = useCallback(async () => {
    const refreshToken = refreshRef.current;
    if (!refreshToken) throw new Error('Not authenticated');
    const { revoked } = await revokeOtherSessionsRequest(refreshToken);
    return revoked;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      accessToken,
      sessionId,
      restoring,
      login,
      loginWithOtp,
      logout,
      updateUser,
      changePassword,
      revokeOtherSessions,
      authedFetch,
    }),
    [
      user,
      accessToken,
      sessionId,
      restoring,
      login,
      loginWithOtp,
      logout,
      updateUser,
      changePassword,
      revokeOtherSessions,
      authedFetch,
    ],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
