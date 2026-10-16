// SM-2 mit vier Bewertungsstufen (wie Anki). Reine Funktionen, Zeit kommt als Tagesnummer herein.

export type Rating = 1 | 2 | 3 | 4;

export const RATINGS: readonly Rating[] = [1, 2, 3, 4];

export const RATING_LABELS: Record<Rating, string> = {
  1: 'Nochmal',
  2: 'Schwer',
  3: 'Gut',
  4: 'Leicht',
};

export interface SrsState {
  /** Leichtigkeitsfaktor (EF), mindestens 1.3 */
  ease: number;
  /** Abstand zur nächsten Wiederholung in Tagen; 0 = noch in dieser Sitzung */
  interval: number;
  /** Fälligkeit als Tagesnummer (siehe day.ts) */
  due: number;
  /** Erfolgreiche Wiederholungen in Folge */
  reps: number;
  /** Wie oft eine bereits gelernte Karte vergessen wurde */
  lapses: number;
}

export const START_EASE = 2.5;
export const MIN_EASE = 1.3;

// Schwer/Gut/Leicht entsprechen den SM-2-Qualitäten 3/4/5; "Nochmal" senkt den Faktor wie bei Anki.
const EASE_DELTA: Record<Rating, number> = { 1: -0.2, 2: -0.14, 3: 0, 4: 0.1 };

export function newState(today: number): SrsState {
  return { ease: START_EASE, interval: 0, due: today, reps: 0, lapses: 0 };
}

export function schedule(state: SrsState, rating: Rating, today: number): SrsState {
  const ease = Math.max(MIN_EASE, round2(state.ease + EASE_DELTA[rating]));
  if (rating === 1) {
    return {
      ease,
      interval: 0,
      due: today,
      reps: 0,
      lapses: state.lapses + (state.reps > 0 ? 1 : 0),
    };
  }
  const interval = nextInterval(state, rating, ease);
  return { ease, interval, due: today + interval, reps: state.reps + 1, lapses: state.lapses };
}

function nextInterval(state: SrsState, rating: 2 | 3 | 4, ease: number): number {
  if (state.reps === 0) return rating === 4 ? 4 : 1;
  const good =
    state.reps === 1
      ? Math.max(6, state.interval + 1)
      : Math.max(state.interval + 1, Math.round(state.interval * ease));
  if (rating === 3) return good;
  if (rating === 4) return Math.max(good + 1, Math.round(good * 1.3));
  return Math.min(good, Math.max(state.interval + 1, Math.round(state.interval * 1.2)));
}

/** Abstände, die jede Bewertung ergeben würde – für die Beschriftung der Buttons. */
export function previewIntervals(state: SrsState, today: number): Record<Rating, number> {
  return {
    1: schedule(state, 1, today).interval,
    2: schedule(state, 2, today).interval,
    3: schedule(state, 3, today).interval,
    4: schedule(state, 4, today).interval,
  };
}

export function formatInterval(days: number): string {
  if (days <= 0) return 'gleich';
  if (days === 1) return '1 Tag';
  if (days < 30) return `${days} Tage`;
  if (days < 365) return `${trim1(days / 30)} Mon.`;
  return `${trim1(days / 365)} J.`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function trim1(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}
