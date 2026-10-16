import type { Rating } from './sm2';

/** Lerntage in Folge. Zählt bis gestern weiter, solange heute noch nicht gelernt wurde. */
export function streak(activeDays: Iterable<number>, today: number): number {
  const days = new Set(activeDays);
  let day = days.has(today) ? today : today - 1;
  let count = 0;
  while (days.has(day)) {
    count++;
    day--;
  }
  return count;
}

/** Anteil der Bewertungen, die nicht "Nochmal" waren (0..1), oder null ohne Daten. */
export function accuracy(ratings: readonly Rating[]): number | null {
  if (ratings.length === 0) return null;
  return ratings.filter((r) => r > 1).length / ratings.length;
}
