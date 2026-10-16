const MS_PER_DAY = 86_400_000;

/** Tage seit 1970-01-01 in lokaler Zeit – ein Lerntag wechselt um Mitternacht Ortszeit. */
export function dayNumber(date: Date = new Date()): number {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / MS_PER_DAY);
}

/** Lokales Datum als JJJJ-MM-TT. */
export function isoDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
