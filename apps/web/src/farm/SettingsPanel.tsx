import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { LocateFixed } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFarmSettings, useSaveSettings } from '../api/ops.hooks';
import { fmtInr } from '../lib/format';
import {
  Button,
  CardSkeleton,
  Field,
  Input,
  PanelError,
  PanelHeading,
  Select,
  SubPanel,
  useToast,
} from '../ui';
import type { FarmSettings } from './api';

const TIERS = ['', 'BASIC', 'STATE', 'CENTRAL'] as const;

// Canonical GSTIN shape: 2-digit state code + PAN (5 letters, 4 digits, 1 letter)
// + entity code + literal 'Z' + checksum character.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const inRange = (v: string, min: number, max: number) => {
  if (v.trim() === '') return true;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max;
};

const settingsSchema = z.object({
  fssaiLicenseNo: z
    .string()
    .refine((v) => v.trim() === '' || /^\d{14}$/.test(v.trim()), 'settings.invalidFssai'),
  fssaiTier: z.string(),
  gstin: z
    .string()
    .refine((v) => v.trim() === '' || GSTIN_RE.test(v.trim().toUpperCase()), 'settings.invalidGstin'),
  latitude: z.string().refine((v) => inRange(v, -90, 90), 'settings.invalidLatitude'),
  longitude: z.string().refine((v) => inRange(v, -180, 180), 'settings.invalidLongitude'),
});
type SettingsValues = z.infer<typeof settingsSchema>;

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground tabular">{value}</span>
    </div>
  );
}

function SettingsForm({ initial, canWrite }: { initial: FarmSettings; canWrite: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const saveSettings = useSaveSettings();
  const [locating, setLocating] = useState(false);
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      fssaiLicenseNo: initial.fssaiLicenseNo ?? '',
      fssaiTier: initial.fssaiTier ?? '',
      gstin: initial.gstin ?? '',
      latitude: initial.latitude === null ? '' : String(initial.latitude),
      longitude: initial.longitude === null ? '' : String(initial.longitude),
    },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = form.handleSubmit((v) => {
    saveSettings.mutate({
      fssaiLicenseNo: v.fssaiLicenseNo.trim() || null,
      fssaiTier: v.fssaiTier || null,
      gstin: v.gstin.trim() ? v.gstin.trim().toUpperCase() : null,
      latitude: v.latitude.trim() === '' ? null : Number(v.latitude),
      longitude: v.longitude.trim() === '' ? null : Number(v.longitude),
    });
  });

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      toast.error(t('settings.geoDenied'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue('latitude', pos.coords.latitude.toFixed(4), { shouldValidate: true, shouldDirty: true });
        form.setValue('longitude', pos.coords.longitude.toFixed(4), { shouldValidate: true, shouldDirty: true });
        setLocating(false);
      },
      () => {
        toast.error(t('settings.geoDenied'));
        setLocating(false);
      },
      { timeout: 10_000 },
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
      <Field label={t('settings.fssai')} error={err(form.formState.errors.fssaiLicenseNo?.message)}>
        <Input inputMode="numeric" maxLength={14} disabled={!canWrite} {...form.register('fssaiLicenseNo')} />
      </Field>

      <Field label={t('settings.tier')}>
        <Select disabled={!canWrite} {...form.register('fssaiTier')}>
          {TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier === '' ? t('settings.tierNone') : tier}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('settings.gstin')} error={err(form.formState.errors.gstin?.message)}>
        <Input maxLength={15} autoCapitalize="characters" disabled={!canWrite} {...form.register('gstin')} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t('settings.latitude')}
          hint={t('settings.locationHint')}
          error={err(form.formState.errors.latitude?.message)}
        >
          <Input type="number" step="0.0001" disabled={!canWrite} {...form.register('latitude')} />
        </Field>
        <Field label={t('settings.longitude')} error={err(form.formState.errors.longitude?.message)}>
          <Input type="number" step="0.0001" disabled={!canWrite} {...form.register('longitude')} />
        </Field>
      </div>

      {canWrite && (
        <Button type="button" variant="secondary" size="sm" loading={locating} onClick={useMyLocation}>
          <LocateFixed aria-hidden />
          {t('settings.useLocation')}
        </Button>
      )}

      <SubPanel className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('settings.readonlyTitle')}
        </p>
        <ReadonlyRow label={t('settings.timezone')} value={initial.timezone} />
        <ReadonlyRow label={t('settings.currency')} value={initial.currency} />
        <ReadonlyRow label={t('settings.areaUnit')} value={initial.areaUnit} />
        <ReadonlyRow
          label={t('settings.gstThreshold')}
          value={initial.gstThresholdPaise !== null ? fmtInr(initial.gstThresholdPaise) : t('settings.tierNone')}
        />
      </SubPanel>

      {canWrite && (
        <Button type="submit" full loading={saveSettings.isPending}>
          {t('common.save')}
        </Button>
      )}
    </form>
  );
}

export function SettingsPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const settings = useFarmSettings();

  return (
    <section className="space-y-3">
      <PanelHeading>{t('settings.title')}</PanelHeading>

      {settings.isPending && <CardSkeleton />}

      {settings.isError && (
        <div className="space-y-2">
          <PanelError>{t('settings.error')}</PanelError>
          <Button type="button" variant="secondary" size="sm" onClick={() => void settings.refetch()}>
            {t('settings.retry')}
          </Button>
        </div>
      )}

      {settings.data && <SettingsForm key={farmId} initial={settings.data} canWrite={canWrite} />}
    </section>
  );
}
