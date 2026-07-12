import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import type { PublicUser } from '../auth/api';
import { PasswordInput } from '../auth/PasswordInput';
import { useApiMutation } from '../lib/useApiMutation';
import { fmtDateTime } from '../lib/format';
import { SUPPORTED_LANGS } from '../i18n';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  PanelError,
  PanelNote,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../ui';
import {
  listSessionsRequest,
  meKeys,
  revokeSessionRequest,
  updateMeRequest,
  type SessionRow,
  type UpdateMeBody,
} from './api';
import { deviceLabel } from './device';

const PHONE_RE = /^\+?[0-9]{8,15}$/;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Account dialog (user menu → Account): Profile / Security / Devices tabs. */
export function AccountDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('account.title')}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">{t('account.tabs.profile')}</TabsTrigger>
            <TabsTrigger value="security">{t('account.tabs.security')}</TabsTrigger>
            <TabsTrigger value="sessions">{t('account.tabs.sessions')}</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <ProfileTab user={user} />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>
          <TabsContent value="sessions">
            <SessionsTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

type ProfileValues = { name: string; phone: string; locale: string };

function ProfileTab({ user }: { user: PublicUser }) {
  const { t, i18n } = useTranslation();
  const { updateUser } = useAuth();

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t('account.profile.errors.name')),
        phone: z
          .string()
          .trim()
          .refine((v) => v === '' || PHONE_RE.test(v), t('account.profile.errors.phone')),
        locale: z.string(),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, dirtyFields },
  } = useForm<ProfileValues>({
    resolver: zodResolver(schema),
    // The public user shape has no phone; blank means "keep current" (see hint).
    defaultValues: { name: user.name, phone: '', locale: user.locale },
  });

  const mutation = useApiMutation<{ user: PublicUser }, UpdateMeBody>({
    mutationFn: (body) => updateMeRequest(body),
    successKey: 'account.profile.saved',
    errorKeyByCode: { PHONE_TAKEN: 'account.profile.phoneTaken' },
    onSuccess: ({ user: next }, body) => {
      updateUser(next);
      // Locale is the app language: switch + persist (ifm.lang) via i18n.
      if (body.locale && body.locale !== i18n.resolvedLanguage) {
        void i18n.changeLanguage(body.locale);
      }
      reset({ name: next.name, phone: '', locale: next.locale });
    },
  });

  const onSubmit = handleSubmit((values) => {
    const body: UpdateMeBody = {};
    if (dirtyFields.name) body.name = values.name.trim();
    if (dirtyFields.phone && values.phone.trim() !== '') body.phone = values.phone.trim();
    if (dirtyFields.locale) body.locale = values.locale;
    if (Object.keys(body).length === 0) return;
    mutation.mutate(body);
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="max-w-md space-y-4" noValidate>
      <Field label={t('account.profile.name')} required error={errors.name?.message}>
        <Input autoComplete="name" {...register('name')} />
      </Field>

      <Field
        label={t('account.profile.phone')}
        error={errors.phone?.message}
        hint={t('account.profile.phoneHint')}
      >
        <Input type="tel" inputMode="tel" autoComplete="tel" {...register('phone')} />
      </Field>

      <Field label={t('account.profile.locale')}>
        <Select {...register('locale')}>
          {SUPPORTED_LANGS.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {t(`account.profile.locales.${lang.code}`)}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit" loading={mutation.isPending}>
        {t('account.profile.save')}
      </Button>
    </form>
  );
}

type SecurityValues = { currentPassword: string; newPassword: string };

function SecurityTab() {
  const { t } = useTranslation();
  const { changePassword } = useAuth();

  const schema = useMemo(
    () =>
      z.object({
        currentPassword: z.string().min(1, t('account.security.errors.current')),
        newPassword: z.string().min(8, t('account.security.errors.min')),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SecurityValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const mutation = useApiMutation<void, SecurityValues>({
    mutationFn: ({ currentPassword, newPassword }) => changePassword(currentPassword, newPassword),
    successKey: 'account.security.changed',
    errorKeyByCode: { INVALID_CREDENTIALS: 'account.security.wrongCurrent' },
    // The API revoked every other session — refresh the devices list.
    invalidate: [meKeys.sessions],
    onSuccess: () => reset(),
  });

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="max-w-md space-y-4" noValidate>
      <PanelNote>{t('account.security.note')}</PanelNote>

      <Field label={t('account.security.current')} required error={errors.currentPassword?.message}>
        <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
      </Field>

      <Field
        label={t('account.security.new')}
        required
        error={errors.newPassword?.message}
        hint={t('account.security.newHint')}
      >
        <PasswordInput autoComplete="new-password" {...register('newPassword')} />
      </Field>

      <Button type="submit" loading={mutation.isPending}>
        {t('account.security.submit')}
      </Button>
    </form>
  );
}

function SessionsTab() {
  const { t } = useTranslation();
  const { sessionId, revokeOtherSessions } = useAuth();
  const [revokeTarget, setRevokeTarget] = useState<SessionRow | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);

  const query = useQuery({
    queryKey: meKeys.sessions,
    queryFn: async () => (await listSessionsRequest()).sessions,
  });

  const revokeOne = useApiMutation<{ ok: true }, string>({
    mutationFn: (id) => revokeSessionRequest(id),
    successKey: 'account.sessions.revoked',
    invalidate: [meKeys.sessions],
    onSuccess: () => setRevokeTarget(null),
  });

  const revokeOthers = useApiMutation<number, void>({
    mutationFn: () => revokeOtherSessions(),
    successKey: 'account.sessions.othersRevoked',
    invalidate: [meKeys.sessions],
    onSuccess: () => setConfirmOthers(false),
  });

  const label = (row: SessionRow) => deviceLabel(row.userAgent) || t('account.sessions.unknownDevice');

  if (query.isError) {
    return (
      <div className="space-y-3">
        <PanelError>{t('account.sessions.error')}</PanelError>
        <Button type="button" variant="secondary" size="sm" onClick={() => void query.refetch()}>
          {t('account.sessions.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setConfirmOthers(true)}
          disabled={query.isLoading}
        >
          {t('account.sessions.revokeOthers')}
        </Button>
      </div>

      <DataTable<SessionRow>
        columns={[
          {
            id: 'device',
            header: 'account.sessions.device',
            accessor: (row) => label(row),
            cell: (row) => (
              <span className="inline-flex flex-wrap items-center gap-2">
                {label(row)}
                {row.id === sessionId && (
                  <Badge variant="success">{t('account.sessions.thisDevice')}</Badge>
                )}
              </span>
            ),
          },
          { header: 'account.sessions.ip', accessor: 'ip' },
          {
            header: 'account.sessions.created',
            accessor: 'createdAt',
            cell: (row) => fmtDateTime(row.createdAt),
          },
          {
            header: 'account.sessions.lastUsed',
            accessor: 'lastUsedAt',
            cell: (row) => fmtDateTime(row.lastUsedAt),
          },
          {
            id: 'actions',
            header: null,
            cell: (row) =>
              row.id === sessionId ? null : (
                <Button type="button" variant="danger" size="sm" onClick={() => setRevokeTarget(row)}>
                  {t('account.sessions.revoke')}
                </Button>
              ),
          },
        ]}
        data={query.data}
        isLoading={query.isLoading}
        emptyState={<PanelNote>{t('account.sessions.empty')}</PanelNote>}
        getRowId={(row) => row.id}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRevokeTarget(null);
        }}
        title={t('account.sessions.revokeTitle')}
        description={t('account.sessions.revokeDescription', {
          device: revokeTarget ? label(revokeTarget) : '',
        })}
        confirmLabel={t('account.sessions.revoke')}
        variant="danger"
        loading={revokeOne.isPending}
        onConfirm={() => {
          if (revokeTarget) revokeOne.mutate(revokeTarget.id);
        }}
      />

      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title={t('account.sessions.revokeOthersTitle')}
        description={t('account.sessions.revokeOthersDescription')}
        confirmLabel={t('account.sessions.revokeOthers')}
        variant="danger"
        loading={revokeOthers.isPending}
        onConfirm={() => revokeOthers.mutate()}
      />
    </div>
  );
}
