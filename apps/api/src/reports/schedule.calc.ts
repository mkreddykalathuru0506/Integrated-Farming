export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/** Next run timestamp from `from`, advanced by the schedule frequency. Pure + deterministic. */
export function nextRun(from: Date, frequency: Frequency): Date {
  const d = new Date(from.getTime());
  if (frequency === 'DAILY') d.setUTCDate(d.getUTCDate() + 1);
  else if (frequency === 'WEEKLY') d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1); // MONTHLY (calendar month)
  return d;
}
