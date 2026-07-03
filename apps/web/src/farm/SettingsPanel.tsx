import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, PanelError, PanelHeading, PanelNote, Select } from '../ui';
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
        latitude: settings.latitude,
        longitude: settings.longitude,
      });
      setSettings(r.settings);
      setSaved(true);
    } catch {
      setError(true);
    }
  }

  if (error && !settings) {
    return <PanelError>{t('settings.error')}</PanelError>;
  }
  if (!settings) return <PanelNote>{t('settings.loading')}</PanelNote>;

  const set = (patch: Partial<FarmSettings>) => setSettings({ ...settings, ...patch });

  return (
    <form onSubmit={onSave} className="space-y-3">
      <PanelHeading>{t('settings.title')}</PanelHeading>

      <label className="block space-y-1 text-sm text-foreground">
        <span>{t('settings.fssai')}</span>
        <Input
          value={settings.fssaiLicenseNo ?? ''}
          onChange={(e) => set({ fssaiLicenseNo: e.target.value || null })}
          disabled={!canWrite}
        />
      </label>

      <label className="block space-y-1 text-sm text-foreground">
        <span>{t('settings.tier')}</span>
        <Select
          value={settings.fssaiTier ?? ''}
          onChange={(e) => set({ fssaiTier: e.target.value || null })}
          disabled={!canWrite}
        >
          {TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier === '' ? t('settings.tierNone') : tier}
            </option>
          ))}
        </Select>
      </label>

      <label className="block space-y-1 text-sm text-foreground">
        <span>{t('settings.gstin')}</span>
        <Input
          value={settings.gstin ?? ''}
          onChange={(e) => set({ gstin: e.target.value || null })}
          disabled={!canWrite}
        />
      </label>

      <div className="flex gap-2">
        <label className="block flex-1 space-y-1 text-sm text-foreground">
          <span>{t('settings.latitude')}</span>
          <Input
            type="number"
            step="0.0001"
            value={settings.latitude ?? ''}
            onChange={(e) => set({ latitude: e.target.value === '' ? null : Number(e.target.value) })}
            disabled={!canWrite}
          />
        </label>
        <label className="block flex-1 space-y-1 text-sm text-foreground">
          <span>{t('settings.longitude')}</span>
          <Input
            type="number"
            step="0.0001"
            value={settings.longitude ?? ''}
            onChange={(e) => set({ longitude: e.target.value === '' ? null : Number(e.target.value) })}
            disabled={!canWrite}
          />
        </label>
      </div>

      {saved && <p className="text-sm text-success">{t('settings.saved')}</p>}
      {error && <PanelError>{t('settings.error')}</PanelError>}

      {canWrite && (
        <Button type="submit" full>
          {t('common.save')}
        </Button>
      )}
    </form>
  );
}
