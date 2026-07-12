import { useState } from 'react';
import { LoginForm } from '../components/LoginForm';
import { RegisterForm } from './RegisterForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

type View = 'login' | 'register' | 'forgot';

/**
 * Unauthenticated experience inside App's CenterShell: client-state switch
 * between sign-in (password/OTP), create-account and forgot-password views.
 */
export function PreAuth() {
  const [view, setView] = useState<View>('login');

  if (view === 'register') return <RegisterForm onLogin={() => setView('login')} />;
  if (view === 'forgot') {
    return <ForgotPasswordForm onDone={() => setView('login')} onBack={() => setView('login')} />;
  }
  return <LoginForm onRegister={() => setView('register')} onForgot={() => setView('forgot')} />;
}
