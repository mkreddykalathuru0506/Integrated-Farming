import { createContext, useContext, useState, type ReactNode } from 'react';
import { loginRequest, logoutRequest, type PublicUser } from './api';

type AuthState = {
  user: PublicUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

// Phase 0: tokens held in memory (lost on reload). Persisted token storage +
// silent refresh-on-load arrive in a later slice.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  async function login(email: string, password: string) {
    const res = await loginRequest(email, password);
    setAccessToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    setUser(res.user);
  }

  async function logout() {
    if (refreshToken) await logoutRequest(refreshToken).catch(() => undefined);
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, accessToken, login, logout }}>{children}</AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
