import { prisma } from '../prisma';
import { ageInDays, categorizeVaccinations, type VaxItem } from '../health/vaccination';
import { reminders as maintenanceReminders } from '../assets/service';
import { reminders as financeReminders } from '../finance/loan.service';
import { listTasks } from '../tasks/service';

const IST_OFFSET_MS = 330 * 60_000;

/** Today's date in Asia/Kolkata as YYYY-MM-DD. */
function istToday(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Vaccinations currently due across all ACTIVE batches — a batched version of
 * health.listVaccinations (3 queries + the pure categorizer, instead of N per batch).
 */
async function vaccinationsDue(farmId: string, now: Date) {
  const batches = await prisma.batch.findMany({
    where: { farmId, deletedAt: null, status: 'ACTIVE' },
    select: { id: true, code: true, speciesId: true, acquiredAt: true, createdAt: true },
  });
  if (batches.length === 0) return [];

  const [items, events] = await Promise.all([
    prisma.vaccinationScheduleItem.findMany({
      where: { farmId, speciesId: { in: [...new Set(batches.map((b) => b.speciesId))] } },
      orderBy: { ageDays: 'asc' },
      select: { id: true, vaccineName: true, type: true, ageDays: true, speciesId: true },
    }),
    prisma.vaccinationEvent.findMany({
      where: { farmId, batchId: { in: batches.map((b) => b.id) } },
      select: { batchId: true, vaccineName: true },
    }),
  ]);

  const itemsBySpecies = new Map<string, (VaxItem & { speciesId: string })[]>();
  for (const it of items) {
    const list = itemsBySpecies.get(it.speciesId) ?? [];
    list.push(it);
    itemsBySpecies.set(it.speciesId, list);
  }
  const doneByBatch = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.batchId) continue;
    const set = doneByBatch.get(e.batchId) ?? new Set<string>();
    set.add(e.vaccineName);
    doneByBatch.set(e.batchId, set);
  }

  const result: { batch: { id: string; code: string }; due: { id: string; vaccineName: string; ageDays: number }[] }[] = [];
  for (const b of batches) {
    const speciesItems = itemsBySpecies.get(b.speciesId) ?? [];
    if (speciesItems.length === 0) continue;
    const age = ageInDays(b.acquiredAt ?? b.createdAt, now);
    const { due } = categorizeVaccinations(speciesItems, age, doneByBatch.get(b.id) ?? new Set());
    if (due.length > 0) {
      result.push({
        batch: { id: b.id, code: b.code },
        due: due.map((d) => ({ id: d.id, vaccineName: d.vaccineName, ageDays: d.ageDays })),
      });
    }
  }
  return result;
}

/**
 * Farm-wide "due soon" rollup (slice 11.5a, read-only) — composes existing reminder
 * logic: vaccinations due now, maintenance due within `days`, EMI/insurance reminders
 * (fixed 7/30-day windows — see `windows` meta) and today's PENDING tasks (IST).
 */
export async function dueRollup(farmId: string, days: number) {
  const now = new Date();
  const [vaccinations, maintenance, finance, tasksToday] = await Promise.all([
    vaccinationsDue(farmId, now),
    maintenanceReminders(farmId, days),
    financeReminders(farmId),
    listTasks(farmId, { date: istToday(now), status: 'PENDING' }),
  ]);

  return {
    days,
    counts: {
      vaccinations: vaccinations.reduce((s, v) => s + v.due.length, 0),
      maintenance: maintenance.due.length,
      emi: finance.emiDue.length,
      insurance: finance.policiesExpiring.length,
      tasks: tasksToday.length,
    },
    windows: { maintenanceDays: days, emiDays: 7, insuranceDays: 30 },
    vaccinations,
    maintenance: maintenance.due,
    emiDue: finance.emiDue,
    policiesExpiring: finance.policiesExpiring,
    tasksToday,
  };
}
