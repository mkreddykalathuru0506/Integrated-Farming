export type MedRef = { withdrawalUntil: Date };

/** Under withdrawal if any medication's withdrawalUntil is still in the future. */
export function isUnderWithdrawal(meds: MedRef[], now: Date): boolean {
  return meds.some((m) => m.withdrawalUntil.getTime() > now.getTime());
}

/** The latest active withdrawal end date, or null if clear. */
export function activeUntil(meds: MedRef[], now: Date): Date | null {
  const active = meds.map((m) => m.withdrawalUntil).filter((d) => d.getTime() > now.getTime());
  return active.length ? new Date(Math.max(...active.map((d) => d.getTime()))) : null;
}
