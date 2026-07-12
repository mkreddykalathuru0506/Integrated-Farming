import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { otpRequestRequest } from './api';
import { authErrorKey } from './errors';
import { useCountdown } from './useCountdown';
import { OtpCodeInput } from './OtpCodeInput';
import { Button, Field, Input, PanelError, PanelNote } from '../ui';

type Props = {
  /** Switch back to the password sign-in view. */
  onUsePassword: () => void;
};

/**
 * Passwordless email-OTP sign-in: request a 6-digit LOGIN code, then verify it.
 * The issuance response is enumeration-proof, so the "sent" note is generic.
 */
export function OtpLogin({ onUsePassword }: Props) {
  const { t } = useTranslation();
  const { loginWithOtp } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { seconds, start } = useCountdown();

  async function sendCode() {
    setError(null);
    setSending(true);
    try {
      const issued = await otpRequestRequest(email, 'LOGIN');
      start(issued.retryAfterSec ?? 60);
      setCode('');
      setStep('code');
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setSending(false);
    }
  }

  async function verify() {
    setError(null);
    setVerifying(true);
    try {
      await loginWithOtp(email, code); // success → session applied, app takes over
    } catch (err) {
      setError(t(authErrorKey(err)));
      setVerifying(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (step === 'email') void sendCode();
    else void verify();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h2 className="font-display text-lg font-bold text-foreground">{t('auth.otp.title')}</h2>

      {step === 'email' ? (
        <>
          <PanelNote>{t('auth.otp.hint')}</PanelNote>
          <Field label={t('auth.login.email')} required>
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          {error && <PanelError>{error}</PanelError>}
          <Button type="submit" full loading={sending} disabled={email.trim().length === 0}>
            {sending ? t('auth.otp.sending') : t('auth.otp.send')}
          </Button>
        </>
      ) : (
        <>
          <PanelNote>{t('auth.otp.sentTo', { email })}</PanelNote>
          <Field label={t('auth.otp.codeLabel')} required>
            <OtpCodeInput value={code} onChange={setCode} />
          </Field>
          {error && <PanelError>{error}</PanelError>}
          <Button type="submit" full loading={verifying} disabled={code.length !== 6}>
            {verifying ? t('auth.otp.verifying') : t('auth.otp.verify')}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={seconds > 0}
              loading={sending}
              onClick={() => void sendCode()}
            >
              {seconds > 0 ? t('auth.otp.resendIn', { seconds }) : t('auth.otp.resend')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep('email')}>
              {t('auth.otp.changeEmail')}
            </Button>
          </div>
        </>
      )}

      <Button type="button" variant="ghost" size="sm" full onClick={onUsePassword}>
        {t('auth.otp.passwordToggle')}
      </Button>
    </form>
  );
}
