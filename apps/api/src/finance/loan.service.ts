import { prisma } from '../prisma';
import { AppError } from '../errors';
import { dueWithin } from './calc';
import type { CreateInsuranceInput, CreateLoanInput, LoanPaymentInput } from './schemas';

const loanDTO = (l: {
  id: string;
  lender: string;
  principalPaise: bigint;
  emiAmountPaise: bigint | null;
  startDate: Date;
  nextDueDate: Date | null;
  status: string;
}) => ({
  id: l.id,
  lender: l.lender,
  principalPaise: l.principalPaise.toString(),
  emiAmountPaise: l.emiAmountPaise === null ? null : l.emiAmountPaise.toString(),
  startDate: l.startDate,
  nextDueDate: l.nextDueDate,
  status: l.status,
});

const LOAN_SELECT = {
  id: true,
  lender: true,
  principalPaise: true,
  emiAmountPaise: true,
  startDate: true,
  nextDueDate: true,
  status: true,
} as const;

export async function createLoan(farmId: string, userId: string, input: CreateLoanInput) {
  const l = await prisma.loan.create({
    data: {
      farmId,
      lender: input.lender,
      principalPaise: BigInt(input.principalPaise),
      emiAmountPaise: input.emiAmountPaise !== undefined ? BigInt(input.emiAmountPaise) : null,
      interestRateBps: input.interestRateBps,
      tenureMonths: input.tenureMonths,
      startDate: new Date(input.startDate),
      nextDueDate: input.nextDueDate ? new Date(input.nextDueDate) : null,
      notes: input.notes,
      createdBy: userId,
    },
    select: LOAN_SELECT,
  });
  return loanDTO(l);
}

export async function listLoans(farmId: string) {
  const rows = await prisma.loan.findMany({ where: { farmId, deletedAt: null }, orderBy: { startDate: 'desc' }, select: LOAN_SELECT });
  return rows.map(loanDTO);
}

export async function recordLoanPayment(farmId: string, loanId: string, userId: string, input: LoanPaymentInput) {
  const loan = await prisma.loan.findFirst({ where: { id: loanId, farmId, deletedAt: null } });
  if (!loan) throw new AppError(404, 'NOT_FOUND', 'Loan not found');
  const p = await prisma.loanPayment.create({
    data: {
      farmId,
      loanId,
      amountPaise: BigInt(input.amountPaise),
      paidAt: input.paidAt ? new Date(input.paidAt) : undefined,
      createdBy: userId,
    },
    select: { id: true, amountPaise: true, paidAt: true },
  });
  return { id: p.id, amountPaise: p.amountPaise.toString(), paidAt: p.paidAt };
}

const insDTO = (i: {
  id: string;
  provider: string;
  type: string;
  premiumPaise: bigint;
  endDate: Date;
  status: string;
  policyNumber: string | null;
}) => ({
  id: i.id,
  provider: i.provider,
  type: i.type,
  premiumPaise: i.premiumPaise.toString(),
  endDate: i.endDate,
  status: i.status,
  policyNumber: i.policyNumber,
});

const INS_SELECT = {
  id: true,
  provider: true,
  type: true,
  premiumPaise: true,
  endDate: true,
  status: true,
  policyNumber: true,
} as const;

export async function createInsurance(farmId: string, userId: string, input: CreateInsuranceInput) {
  const i = await prisma.insurance.create({
    data: {
      farmId,
      provider: input.provider,
      policyNumber: input.policyNumber,
      type: input.type,
      premiumPaise: BigInt(input.premiumPaise),
      sumInsuredPaise: input.sumInsuredPaise !== undefined ? BigInt(input.sumInsuredPaise) : null,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      notes: input.notes,
      createdBy: userId,
    },
    select: INS_SELECT,
  });
  return insDTO(i);
}

export async function listInsurance(farmId: string) {
  const rows = await prisma.insurance.findMany({ where: { farmId, deletedAt: null }, orderBy: { endDate: 'asc' }, select: INS_SELECT });
  return rows.map(insDTO);
}

export async function reminders(farmId: string) {
  const now = new Date();
  const [loans, policies] = await Promise.all([
    prisma.loan.findMany({ where: { farmId, deletedAt: null, status: 'ACTIVE', nextDueDate: { not: null } }, select: LOAN_SELECT }),
    prisma.insurance.findMany({ where: { farmId, deletedAt: null, status: 'ACTIVE' }, select: INS_SELECT }),
  ]);
  return {
    emiDue: loans.filter((l) => l.nextDueDate && dueWithin(l.nextDueDate, 7, now)).map(loanDTO),
    policiesExpiring: policies.filter((p) => dueWithin(p.endDate, 30, now)).map(insDTO),
  };
}
