import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Landmark, ShieldCheck } from 'lucide-react';
import {
  useCreateInsurance,
  useCreateLoan,
  useFinanceReminders,
  useInsurance,
  useLoans,
} from '../api/finance.hooks';
import { fmtDate, fmtInr, rupeesToPaise, todayIST } from '../lib/format';
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  InrInput,
  PanelError,
  PanelHeading,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  type DataTableColumn,
} from '../ui';
import type { InsurancePolicy, Loan } from './api';

const INS_TYPES = ['LIVESTOCK', 'ASSET', 'CROP', 'OTHER'] as const;

const dayISO = (s: string) => `${s}T00:00:00.000Z`;
const todayInput = () => todayIST();

/** Mirror of the API's finance dueWithin(): on/before now + N days. */
const dueWithin = (iso: string, days: number) =>
  new Date(iso).getTime() <= Date.now() + days * 86_400_000;

/** Rupee text → valid non-negative paise? ('' allowed when optional=true) */
const money = (msg: string, optional = false) =>
  z.string().refine((s) => {
    if (s.trim() === '') return optional;
    const p = rupeesToPaise(s);
    return p !== null && !p.startsWith('-');
  }, msg);

const loanSchema = z.object({
  lender: z.string().min(1, 'emi.errLender'),
  principal: money('emi.errPrincipal'),
  emi: money('emi.errEmi', true),
  rate: z
    .string()
    .refine((s) => s === '' || (Number.isFinite(Number(s)) && Number(s) >= 0), 'emi.errRate'),
  tenure: z
    .string()
    .refine((s) => s === '' || (Number.isInteger(Number(s)) && Number(s) > 0), 'emi.errTenure'),
  startDate: z.string().min(1, 'emi.errStartDate'),
  nextDue: z.string(),
  notes: z.string(),
});
type LoanValues = z.infer<typeof loanSchema>;

const policySchema = z.object({
  provider: z.string().min(1, 'emi.errProvider'),
  policyNumber: z.string(),
  type: z.string().min(1),
  premium: money('emi.errPremium'),
  sumInsured: money('emi.errSumInsured', true),
  startDate: z.string().min(1, 'emi.errStartDate'),
  endDate: z.string().min(1, 'emi.errEndDate'),
  notes: z.string(),
});
type PolicyValues = z.infer<typeof policySchema>;

const loanStatusVariant = (s: string) =>
  s === 'ACTIVE' ? 'success' : s === 'DEFAULTED' ? 'destructive' : 'muted';
const insStatusVariant = (s: string) =>
  s === 'ACTIVE' ? 'success' : s === 'CANCELLED' ? 'destructive' : s === 'EXPIRED' ? 'warning' : 'muted';

export function EmiInsurancePanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const loans = useLoans();
  const policies = useInsurance();
  const reminders = useFinanceReminders();
  const [dialog, setDialog] = useState<null | 'loan' | 'policy'>(null);

  const loanColumns: DataTableColumn<Loan>[] = [
    {
      header: 'emi.colLender',
      accessor: 'lender',
      cell: (l) => <span className="font-medium text-foreground">{l.lender}</span>,
    },
    {
      header: 'emi.colPrincipal',
      accessor: (l) => l.principalPaise,
      align: 'right',
      cell: (l) => fmtInr(l.principalPaise),
    },
    {
      header: 'emi.colEmi',
      accessor: (l) => l.emiAmountPaise ?? '',
      align: 'right',
      cell: (l) => (l.emiAmountPaise === null ? '—' : fmtInr(l.emiAmountPaise)),
    },
    {
      header: 'emi.colNextDue',
      accessor: (l) => l.nextDueDate ?? '',
      cell: (l) =>
        l.nextDueDate === null ? (
          '—'
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="tabular">{fmtDate(l.nextDueDate)}</span>
            {l.status === 'ACTIVE' && dueWithin(l.nextDueDate, 7) && (
              <Badge variant="warning">{t('emi.dueSoon')}</Badge>
            )}
          </span>
        ),
    },
    {
      header: 'emi.colStatus',
      accessor: 'status',
      cell: (l) => <Badge variant={loanStatusVariant(l.status)}>{t(`emi.loanStatus.${l.status}`)}</Badge>,
    },
  ];

  const insColumns: DataTableColumn<InsurancePolicy>[] = [
    {
      header: 'emi.colProvider',
      accessor: 'provider',
      cell: (p) => <span className="font-medium text-foreground">{p.provider}</span>,
    },
    {
      header: 'emi.colType',
      accessor: 'type',
      cell: (p) => t(`emi.insType.${p.type}`),
    },
    {
      header: 'emi.colPolicyNo',
      accessor: (p) => p.policyNumber ?? '',
      cell: (p) => p.policyNumber ?? '—',
    },
    {
      header: 'emi.colPremium',
      accessor: (p) => p.premiumPaise,
      align: 'right',
      cell: (p) => fmtInr(p.premiumPaise),
    },
    {
      header: 'emi.colEndDate',
      accessor: 'endDate',
      cell: (p) => (
        <span className="inline-flex items-center gap-2">
          <span className="tabular">{fmtDate(p.endDate)}</span>
          {p.status === 'ACTIVE' && dueWithin(p.endDate, 30) && (
            <Badge variant="warning">{t('emi.expiring')}</Badge>
          )}
        </span>
      ),
    },
    {
      header: 'emi.colStatus',
      accessor: 'status',
      cell: (p) => <Badge variant={insStatusVariant(p.status)}>{t(`emi.insStatus.${p.status}`)}</Badge>,
    },
  ];

  const rem = reminders.data;

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" onClick={() => setDialog('loan')}>
                {t('emi.addLoan')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDialog('policy')}>
                {t('emi.addPolicy')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {t('emi.title')}
      </PanelHeading>

      {rem && (rem.emiDue.length > 0 || rem.policiesExpiring.length > 0) && (
        <p className="flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {t('emi.reminder', { emi: rem.emiDue.length, policies: rem.policiesExpiring.length })}
        </p>
      )}

      <Tabs defaultValue="loans">
        <TabsList>
          <TabsTrigger value="loans">{t('emi.tabLoans')}</TabsTrigger>
          <TabsTrigger value="insurance">{t('emi.tabInsurance')}</TabsTrigger>
        </TabsList>

        <TabsContent value="loans">
          {loans.isError ? (
            <div className="space-y-2">
              <PanelError>{t('emi.loansError')}</PanelError>
              <Button size="sm" variant="secondary" onClick={() => void loans.refetch()}>
                {t('emi.retry')}
              </Button>
            </div>
          ) : (
            <DataTable
              columns={loanColumns}
              data={loans.data}
              isLoading={loans.isLoading}
              searchable
              pageSize={10}
              getRowId={(l) => l.id}
              emptyState={
                <EmptyState
                  icon={Landmark}
                  title={t('emi.loansEmpty')}
                  description={t('emi.loansEmptyDesc')}
                  action={
                    canWrite ? (
                      <Button size="sm" onClick={() => setDialog('loan')}>
                        {t('emi.addLoan')}
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          )}
        </TabsContent>

        <TabsContent value="insurance">
          {policies.isError ? (
            <div className="space-y-2">
              <PanelError>{t('emi.insError')}</PanelError>
              <Button size="sm" variant="secondary" onClick={() => void policies.refetch()}>
                {t('emi.retry')}
              </Button>
            </div>
          ) : (
            <DataTable
              columns={insColumns}
              data={policies.data}
              isLoading={policies.isLoading}
              searchable
              pageSize={10}
              getRowId={(p) => p.id}
              emptyState={
                <EmptyState
                  icon={ShieldCheck}
                  title={t('emi.insEmpty')}
                  description={t('emi.insEmptyDesc')}
                  action={
                    canWrite ? (
                      <Button size="sm" onClick={() => setDialog('policy')}>
                        {t('emi.addPolicy')}
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialog === 'loan'} onOpenChange={(o) => setDialog(o ? 'loan' : null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('emi.addLoanTitle')}</DialogTitle>
          </DialogHeader>
          <LoanForm onDone={() => setDialog(null)} />
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === 'policy'} onOpenChange={(o) => setDialog(o ? 'policy' : null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('emi.addPolicyTitle')}</DialogTitle>
          </DialogHeader>
          <PolicyForm onDone={() => setDialog(null)} />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function LoanForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const createLoan = useCreateLoan();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoanValues>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      lender: '',
      principal: '',
      emi: '',
      rate: '',
      tenure: '',
      startDate: todayInput(), // dormant API field surfaced: backdatable start date
      nextDue: '',
      notes: '',
    },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = handleSubmit((v) => {
    createLoan.mutate(
      {
        lender: v.lender,
        principalPaise: rupeesToPaise(v.principal)!, // integer-paise string passthrough
        emiAmountPaise: v.emi.trim() === '' ? undefined : rupeesToPaise(v.emi)!,
        // Interest rate is a percentage (not money): 9.5% → 950 bps.
        interestRateBps: v.rate === '' ? undefined : Math.round(Number(v.rate) * 100),
        tenureMonths: v.tenure === '' ? undefined : Number(v.tenure),
        startDate: dayISO(v.startDate),
        nextDueDate: v.nextDue ? dayISO(v.nextDue) : undefined,
        notes: v.notes.trim() || undefined,
      },
      { onSuccess: onDone },
    );
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <Field label={t('emi.lender')} required error={err(errors.lender?.message)}>
        <Input {...register('lender')} placeholder={t('emi.lenderPlaceholder')} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Controller
          name="principal"
          control={control}
          render={({ field }) => (
            <Field label={t('emi.principal')} required error={err(errors.principal?.message)}>
              <InrInput
                value={field.value}
                onChangePaise={(_, rupees) => field.onChange(rupees)}
                onBlur={field.onBlur}
              />
            </Field>
          )}
        />
        <Controller
          name="emi"
          control={control}
          render={({ field }) => (
            <Field label={t('emi.emi')} error={err(errors.emi?.message)}>
              <InrInput
                value={field.value}
                onChangePaise={(_, rupees) => field.onChange(rupees)}
                onBlur={field.onBlur}
              />
            </Field>
          )}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('emi.interestRate')} error={err(errors.rate?.message)}>
          <Input type="number" min={0} step="0.01" inputMode="decimal" {...register('rate')} />
        </Field>
        <Field label={t('emi.tenure')} error={err(errors.tenure?.message)}>
          <Input type="number" min={1} step={1} inputMode="numeric" {...register('tenure')} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label={t('emi.startDate')}
          required
          hint={t('emi.startDateHint')}
          error={err(errors.startDate?.message)}
        >
          <Input type="date" {...register('startDate')} />
        </Field>
        <Field label={t('emi.nextDue')}>
          <Input type="date" {...register('nextDue')} />
        </Field>
      </div>
      <Field label={t('emi.notes')}>
        <Textarea rows={2} {...register('notes')} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={createLoan.isPending}>
          {t('emi.addLoan')}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PolicyForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const createInsurance = useCreateInsurance();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PolicyValues>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      provider: '',
      policyNumber: '',
      type: 'LIVESTOCK',
      premium: '',
      sumInsured: '',
      startDate: todayInput(), // dormant API field surfaced: backdatable start date
      endDate: '',
      notes: '',
    },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = handleSubmit((v) => {
    createInsurance.mutate(
      {
        provider: v.provider,
        policyNumber: v.policyNumber.trim() || undefined,
        type: v.type,
        premiumPaise: rupeesToPaise(v.premium)!, // integer-paise string passthrough
        sumInsuredPaise: v.sumInsured.trim() === '' ? undefined : rupeesToPaise(v.sumInsured)!,
        startDate: dayISO(v.startDate),
        endDate: dayISO(v.endDate),
        notes: v.notes.trim() || undefined,
      },
      { onSuccess: onDone },
    );
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('emi.provider')} required error={err(errors.provider?.message)}>
          <Input {...register('provider')} />
        </Field>
        <Field label={t('emi.policyNumber')}>
          <Input {...register('policyNumber')} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('emi.colType')} required>
          <Select {...register('type')}>
            {INS_TYPES.map((it) => (
              <option key={it} value={it}>
                {t(`emi.insType.${it}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Controller
          name="premium"
          control={control}
          render={({ field }) => (
            <Field label={t('emi.premium')} required error={err(errors.premium?.message)}>
              <InrInput
                value={field.value}
                onChangePaise={(_, rupees) => field.onChange(rupees)}
                onBlur={field.onBlur}
              />
            </Field>
          )}
        />
      </div>
      <Controller
        name="sumInsured"
        control={control}
        render={({ field }) => (
          <Field label={t('emi.sumInsured')} error={err(errors.sumInsured?.message)}>
            <InrInput
              value={field.value}
              onChangePaise={(_, rupees) => field.onChange(rupees)}
              onBlur={field.onBlur}
            />
          </Field>
        )}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label={t('emi.startDate')}
          required
          hint={t('emi.startDateHint')}
          error={err(errors.startDate?.message)}
        >
          <Input type="date" {...register('startDate')} />
        </Field>
        <Field label={t('emi.endDate')} required error={err(errors.endDate?.message)}>
          <Input type="date" {...register('endDate')} />
        </Field>
      </div>
      <Field label={t('emi.notes')}>
        <Textarea rows={2} {...register('notes')} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={createInsurance.isPending}>
          {t('emi.addPolicy')}
        </Button>
      </DialogFooter>
    </form>
  );
}
