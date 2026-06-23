export type VaxItem = { id: string; vaccineName: string; type: string; ageDays: number };

/** Split schedule items into done (recorded), due (age reached, not recorded), upcoming. */
export function categorizeVaccinations(items: VaxItem[], ageDays: number, done: Set<string>) {
  const due: VaxItem[] = [];
  const upcoming: VaxItem[] = [];
  const doneList: VaxItem[] = [];
  for (const it of items) {
    if (done.has(it.vaccineName)) doneList.push(it);
    else if (ageDays >= it.ageDays) due.push(it);
    else upcoming.push(it);
  }
  return { due, upcoming, done: doneList };
}

/** Whole days between two dates (>= 0). */
export function ageInDays(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
}
