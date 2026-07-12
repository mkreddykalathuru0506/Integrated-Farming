import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { UserPlus, Users, UserX } from 'lucide-react';
import {
  useAddMember,
  useChangeMemberRole,
  useDeactivateMember,
  useMembers,
  type FarmMember,
} from '../api/team.hooks';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PanelError,
  PanelHeading,
  PanelNote,
  Select,
  type BadgeProps,
  type DataTableColumn,
} from '../ui';

/** Mirrors the API's RoleEnum (rbac/schemas.ts). */
const ROLES = ['OWNER', 'MANAGER', 'VETERINARIAN', 'ACCOUNTANT', 'LABOUR', 'BUYER'] as const;

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  ACTIVE: 'success',
  INVITED: 'warning',
  SUSPENDED: 'muted',
};

const addSchema = z.object({
  email: z.string().trim().email('team.errEmail'),
  role: z.string(),
});
type AddValues = z.infer<typeof addSchema>;

function AddMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const addMember = useAddMember();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { email: '', role: 'LABOUR' },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = handleSubmit((v) => {
    addMember.mutate(
      { email: v.email.trim(), role: v.role },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('team.addTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
          <Field label={t('team.email')} required error={err(errors.email?.message)} hint={t('team.emailHint')}>
            <Input type="email" autoComplete="off" {...register('email')} />
          </Field>
          <Field label={t('team.role')}>
            <Select {...register('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={addMember.isPending}>
              {t('team.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Team panel (slice 11.9): members roster from GET /api/farm/members.
 * OWNER (`canManage`) gets add / change-role / deactivate; MANAGER sees the
 * roster read-only. Re-adding a suspended member's email reactivates them.
 */
export function TeamPanel({ canManage }: { farmId: string; canManage: boolean }) {
  const { t } = useTranslation();
  const members = useMembers();
  const changeRole = useChangeMemberRole();
  const deactivate = useDeactivateMember();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<FarmMember | null>(null);

  const columns: DataTableColumn<FarmMember>[] = [
    {
      header: 'team.colName',
      accessor: 'name',
      cell: (m) => <span className="font-medium text-foreground">{m.name}</span>,
    },
    { header: 'team.colEmail', accessor: 'email' },
    {
      header: 'team.colRole',
      accessor: (m) => t(`roles.${m.role}`, m.role),
      cell: (m) =>
        canManage && m.status === 'ACTIVE' ? (
          <Select
            value={m.role}
            aria-label={t('team.changeRole', { name: m.name })}
            disabled={changeRole.isPending}
            onChange={(e) => changeRole.mutate({ userId: m.userId, role: e.target.value })}
            className="w-auto min-w-36"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </Select>
        ) : (
          <Badge variant={m.role === 'OWNER' ? 'accent' : 'default'}>{t(`roles.${m.role}`, m.role)}</Badge>
        ),
    },
    {
      header: 'team.colStatus',
      accessor: 'status',
      cell: (m) => (
        <Badge variant={STATUS_VARIANT[m.status] ?? 'default'}>{t(`team.status.${m.status}`, m.status)}</Badge>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: 'team.colActions',
            cell: (m: FarmMember) =>
              m.status === 'ACTIVE' ? (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={deactivate.isPending}
                  onClick={() => setPendingDeactivate(m)}
                >
                  <UserX aria-hidden />
                  {t('team.deactivate')}
                </Button>
              ) : null,
          } satisfies DataTableColumn<FarmMember>,
        ]
      : []),
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canManage ? (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus aria-hidden /> {t('team.add')}
            </Button>
          ) : undefined
        }
      >
        {t('team.title')}
      </PanelHeading>

      {!canManage && <PanelNote>{t('team.readOnly')}</PanelNote>}

      {members.isError ? (
        <div className="space-y-2">
          <PanelError>{t('team.error')}</PanelError>
          <Button size="sm" variant="secondary" onClick={() => void members.refetch()}>
            {t('team.retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={members.data}
          isLoading={members.isPending}
          searchable
          searchPlaceholderKey="team.search"
          pageSize={10}
          getRowId={(m) => m.id}
          emptyState={
            <EmptyState
              icon={Users}
              title={t('team.empty')}
              description={t('team.emptyDesc')}
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <UserPlus aria-hidden /> {t('team.add')}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      {canManage && <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} />}

      <ConfirmDialog
        open={pendingDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeactivate(null);
        }}
        title={t('team.confirmDeactivateTitle')}
        description={t('team.confirmDeactivateBody', { name: pendingDeactivate?.name ?? '' })}
        confirmLabel={t('team.deactivate')}
        variant="danger"
        loading={deactivate.isPending}
        onConfirm={() => {
          if (!pendingDeactivate) return;
          deactivate.mutate(pendingDeactivate.userId, {
            onSettled: () => setPendingDeactivate(null),
          });
        }}
      />
    </section>
  );
}
