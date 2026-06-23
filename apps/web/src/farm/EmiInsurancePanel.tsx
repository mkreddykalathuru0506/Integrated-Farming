import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise, rupeesToPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Select } from '../ui';
import {
  createInsurance,
  createLoan,
  financeReminders,
  listInsurance,
  listLoans,
  type FinanceReminders,
  type InsurancePolicy,
  type Loan,
} from './api';

const INS_TYPES = ['LIVESTOCK', 'ASSET', 'CROP', 'OTHER'] as const;
const dayISO = (s: string) => `${s}T00:00:00.000Z`;
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString() : '—');

export function EmiInsurancePanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [rem, setRem] = useState<FinanceReminders | null>(null);
  const [lender, setLender] = useState('');
  const [principal, setPrincipal] = useState('');
  const [emi, setEmi] = useState('');
  const [due, setDue] = useState('');
  const [provider, setProvider] = useState('');
  const [insType, setInsType] = useState<string>('LIVESTOCK');
  const [premium, setPremium] = useState('');
  const [endDate, setEndDate] = useState('');

  const refresh = useCallback(() => {
    if (!accessToken) return;
    listLoans(accessToken, farmId).then((r) => setLoans(r.loans)).catch(() => undefined);
    listInsurance(accessToken, farmId).then((r) => setPolicies(r.policies)).catch(() => undefined);
    financeReminders(accessToken, farmId).then(setRem).catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function onLoan(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await createLoan(accessToken, farmId, {
      lender,
      principalPaise: String(rupeesToPaise(Number(principal))),
      emiAmountPaise: emi ? String(rupeesToPaise(Number(emi))) : undefined,
      startDate: new Date().toISOString(),
      nextDueDate: due ? dayISO(due) : undefined,
    })
      .then(() => {
        setLender('');
        setPrincipal('');
        setEmi('');
        setDue('');
        refresh();
      })
      .catch(() => undefined);
  }

  async function onPolicy(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !endDate) return;
    await createInsurance(accessToken, farmId, {
      provider,
      type: insType,
      premiumPaise: String(rupeesToPaise(Number(premium))),
      startDate: new Date().toISOString(),
      endDate: dayISO(endDate),
    })
      .then(() => {
        setProvider('');
        setPremium('');
        setEndDate('');
        refresh();
      })
      .catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('emi.title')}</h2>

      {rem && (rem.emiDue.length > 0 || rem.policiesExpiring.length > 0) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t('emi.reminder', { emi: rem.emiDue.length, policies: rem.policiesExpiring.length })}
        </p>
      )}

      {loans.length > 0 && (
        <ul className="space-y-1 text-sm">
          {loans.map((l) => (
            <li key={l.id} className="flex justify-between rounded-lg border border-slate-200 px-3 py-1.5">
              <span className="text-slate-700">{l.lender}</span>
              <span className="text-slate-500">
                {l.emiAmountPaise ? `${formatPaise(Number(l.emiAmountPaise))}/mo` : formatPaise(Number(l.principalPaise))} · {t('emi.due')} {fmtDate(l.nextDueDate)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {policies.length > 0 && (
        <ul className="space-y-1 text-sm">
          {policies.map((p) => (
            <li key={p.id} className="flex justify-between rounded-lg border border-slate-200 px-3 py-1.5">
              <span className="text-slate-700">
                {p.provider} <span className="text-xs text-slate-400">· {t(`emi.insType.${p.type}`)}</span>
              </span>
              <span className="text-slate-500">
                {formatPaise(Number(p.premiumPaise))} · {t('emi.expires')} {fmtDate(p.endDate)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <>
          <form onSubmit={onLoan} className="space-y-2 rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t('emi.addLoan')}</p>
            <Input value={lender} onChange={(e) => setLender(e.target.value)} placeholder={t('emi.lender')} required />
            <div className="flex gap-2">
              <Input type="number" min={0} value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder={t('emi.principal')} required className="flex-1" />
              <Input type="number" min={0} value={emi} onChange={(e) => setEmi(e.target.value)} placeholder={t('emi.emi')} className="flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="flex-1" />
              <Button type="submit">{t('emi.addLoanBtn')}</Button>
            </div>
          </form>
          <form onSubmit={onPolicy} className="space-y-2 rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t('emi.addPolicy')}</p>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder={t('emi.provider')} required />
            <div className="flex gap-2">
              <Select value={insType} onChange={(e) => setInsType(e.target.value)} className="flex-1">
                {INS_TYPES.map((it) => (
                  <option key={it} value={it}>
                    {t(`emi.insType.${it}`)}
                  </option>
                ))}
              </Select>
              <Input type="number" min={0} value={premium} onChange={(e) => setPremium(e.target.value)} placeholder={t('emi.premium')} required className="flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="flex-1" />
              <Button type="submit">{t('emi.addPolicyBtn')}</Button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
