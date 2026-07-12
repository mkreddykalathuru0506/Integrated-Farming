import { useState, type ReactNode } from 'react';
import { Landing } from './Landing';

export type AuthIntent = 'login' | 'register';

type LandingGateProps = {
  /**
   * Renders the auth experience once a CTA is chosen (or immediately for deep
   * links). `onBack` is provided only when the visitor arrived via the landing,
   * so the auth card can offer a way back to it.
   */
  renderAuth: (initialView: AuthIntent, onBack?: () => void) => ReactNode;
};

/**
 * Unauthenticated front door (slice 11.11): the marketing landing shows at `/`;
 * its CTAs switch to the auth card ("Sign in" → login, "Get started" → register).
 * Deep links to app routes (e.g. `/finance`) land on the auth card directly, as
 * before this slice — after login the router resolves the deep-linked section.
 */
export function LandingGate({ renderAuth }: LandingGateProps) {
  const [intent, setIntent] = useState<AuthIntent | null>(null);
  const isDeepLink = typeof window !== 'undefined' && window.location.pathname !== '/';

  if (!isDeepLink && intent === null) {
    return <Landing onSignIn={() => setIntent('login')} onGetStarted={() => setIntent('register')} />;
  }
  return <>{renderAuth(intent ?? 'login', isDeepLink ? undefined : () => setIntent(null))}</>;
}
