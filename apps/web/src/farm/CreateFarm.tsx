import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { createFarm } from './api';

export function CreateFarm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setError(false);
    setSaving(true);
    try {
      await createFarm(accessToken, { name, state: state || undefined });
      onCreated();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <p className="text-sm text-slate-500">{t('farm.create.prompt')}</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('farm.create.name')}
        required
        className="block min-h-11 w-full rounded-lg border border-slate-300 px-3"
      />
      <input
        value={state}
        onChange={(e) => setState(e.target.value)}
        placeholder={t('farm.create.state')}
        className="block min-h-11 w-full rounded-lg border border-slate-300 px-3"
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('farm.create.error')}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="min-h-11 w-full rounded-lg bg-green-600 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
      >
        {saving ? t('common.saving') : t('farm.create.submit')}
      </button>
    </form>
  );
}
