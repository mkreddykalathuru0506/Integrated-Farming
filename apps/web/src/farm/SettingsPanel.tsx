import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { getSettings, updateSettings, type FarmSettings } from './api';

const TIERS = ['', 'BASIC', 'STATE', 'CENTRAL'] as const;

export function SettingsPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [settings, setSettings] = useState<FarmSettings | null>(null);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    setError(false);
    getSettings(accessToken, farmId)
      .then((r) => setSettings(r.settings))
      .catch(() => setError(true));
  }, [accessToken, farmId]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !settings) return;
    setSaved(false);
    setError(false);
    try {
      const r = await updateSettings(accessToken, farmId, {
        fssaiLicenseNo: settings.fssaiLicenseNo,
        fssaiTier: settings.fssaiTier,
        gstin: settings.gstin,
      });
      setSettings(r.settings);
      setSaved(true);
    } catch {
      setError(true);
    }
  }

  if (error && !settings) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {t('settings.error')}
      </p>
    );
  }
  if (!settings) return <p className="text-sm text-slate-500">{t('settings.loading')}</p>;

  const set = (patch: Partial<FarmSettings>) => setSettings({ ...settings, ...patch });

  return (
    <form onSubmit={onSave} className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        {t('settings.title')}
      </h2>

      <label className="block text-sm text-slate-700">
        {t('settings.fssai')}
        <input
          value={settings.fssaiLicenseNo ?? ''}
          onChange={(e) => set({ fssaiLicenseNo: e.target.value || null })}
          disabled={!canWrite}
          className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 disabled:bg-slate-100"
        />
      </label>

      <label className="block text-sm text-slate-700">
        {t('settings.tier')}
        <select
          value={settings.fssaiTier ?? ''}
          onChange={(e) => set({ fssaiTier: e.target.value || null })}
          disabled={!canWrite}
          className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 disabled:bg-slate-100"
        >
          {TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier === '' ? t('settings.tierNone') : tier}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-slate-700">
        {t('settings.gstin')}
        <input
          value={settings.gstin ?? ''}
          onChange={(e) => set({ gstin: e.target.value || null })}
          disabled={!canWrite}
          className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 disabled:bg-slate-100"
        />
      </label>

      {saved && <p className="text-sm text-green-700">{t('settings.saved')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('settings.error')}
        </p>
      )}

      {canWrite && (
        <button
          type="submit"
          className="min-h-11 w-full rounded-lg bg-green-600 font-semibold text-white hover:bg-green-700"
        >
          {t('common.save')}
        </button>
      )}
    </form>
  );
}
