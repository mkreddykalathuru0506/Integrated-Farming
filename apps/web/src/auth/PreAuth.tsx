import { useState } from 'react';
import { LoginForm } from '../components/LoginForm';
import { RegisterForm } from './RegisterForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

type View = 'login' | 'register' | 'forgot';

type PreAuthProps = {
  /** Which view to open on (landing CTAs deep-link to register). Default: login. */
  initialView?: 'login' | 'register';
};

/**
 * Unauthenticated experience inside App's CenterShell: client-state switch
 * between sign-in (password/OTP), create-account and forgot-password views.
 */
export function PreAuth({ initialView = 'login' }: PreAuthProps = {}) {
  const [view, setView] = useState<View>(initialView);

  if (view === 'register') return <RegisterForm onLogin={() => setView('login')} />;
  if (view === 'forgot') {
    return <ForgotPasswordForm onDone={() => setView('login')} onBack={() => setView('login')} />;
  }
  return <LoginForm onRegister={() => setView('register')} onForgot={() => setView('forgot')} />;
}
