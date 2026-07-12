import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { forgotRequest, resetRequest } from './api';
import { authErrorKey } from './errors';
import { useCountdown } from './useCountdown';
import { OtpCodeInput } from './OtpCodeInput';
import { PasswordInput } from './PasswordInput';
import { Button, Field, Input, PanelError, PanelNote, useToast } from '../ui';

type Props = {
  /** Reset finished — go back to sign-in. */
  onDone: () => void;
  /** Abandon the flow — back to sign-in. */
  onBack: () => void;
};

/**
 * Forgot → reset flow. The issuance response is enumeration-proof, so after
 * requesting a code the confirmation is deliberately generic ("if the account
 * exists…"). A successful reset revokes every session server-side.
 */
export function ForgotPasswordForm({ onDone, onBack }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const { seconds, start } = useCountdown();

  async function sendCode() {
    setError(null);
    setSending(true);
    try {
      const issued = await forgotRequest(email);
      start(issued.retryAfterSec ?? 60);
      setCode('');
      setStep('reset');
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setSending(false);
    }
  }

  async function doReset() {
    setError(null);
    if (code.length !== 6) {
      setError(t('auth.forgot.errors.code'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('auth.forgot.errors.passwordMin'));
      return;
    }
    setSaving(true);
    try {
      await resetRequest(email, code, newPassword);
      toast.success(t('auth.forgot.success'));
      onDone();
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (step === 'email') void sendCode();
    else void doReset();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h2 className="font-display text-lg font-bold text-foreground">{t('auth.forgot.title')}</h2>

      {step === 'email' ? (
        <>
          <PanelNote>{t('auth.forgot.hint')}</PanelNote>
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
            {sending ? t('auth.forgot.sending') : t('auth.forgot.send')}
          </Button>
        </>
      ) : (
        <>
          <PanelNote>{t('auth.forgot.sentBody', { email })}</PanelNote>
          <Field label={t('auth.forgot.code')} required>
            <OtpCodeInput value={code} onChange={setCode} />
          </Field>
          <Field label={t('auth.forgot.newPassword')} required hint={t('auth.forgot.newPasswordHint')}>
            <PasswordInput
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </Field>
          {error && <PanelError>{error}</PanelError>}
          <Button type="submit" full loading={saving}>
            {saving ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            full
            disabled={seconds > 0}
            loading={sending}
            onClick={() => void sendCode()}
          >
            {seconds > 0 ? t('auth.otp.resendIn', { seconds }) : t('auth.otp.resend')}
          </Button>
        </>
      )}

      <Button type="button" variant="ghost" size="sm" full onClick={onBack}>
        {t('auth.forgot.back')}
      </Button>
    </form>
  );
}
