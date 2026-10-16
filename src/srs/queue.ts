import type { Rating, SrsState } from './sm2';

export interface QueueInput {
  /** Kartenschlüssel in Deck-Reihenfolge */
  order: string[];
  states: ReadonlyMap<string, SrsState>;
  today: number;
  /** Wie viele neue Karten heute noch eingeführt werden dürfen */
  newSlots: number;
  /** Wie viele fällige Wiederholungen heute noch erlaubt sind */
  reviewSlots: number;
}

export interface Queue {
  /** In dieser Sitzung noch nicht gekonnte Karten (Abstand 0) – zählen nicht gegen Limits */
  learning: string[];
  review: string[];
  fresh: string[];
  /** Neue bzw. fällige Karten, die wegen des Tageslimits heute nicht drankommen */
  waitingNew: number;
  waitingReview: number;
}

export function buildQueue(input: QueueInput): Queue {
  const learning: string[] = [];
  const due: { key: string; due: number }[] = [];
  const fresh: string[] = [];

  for (const key of input.order) {
    const state = input.states.get(key);
    if (!state) fresh.push(key);
    else if (state.due > input.today) continue;
    else if (state.interval === 0) learning.push(key);
    else due.push({ key, due: state.due });
  }

  due.sort((a, b) => a.due - b.due);
  const reviewSlots = Math.max(0, input.reviewSlots);
  const newSlots = Math.max(0, input.newSlots);

  return {
    learning,
    review: due.slice(0, reviewSlots).map((d) => d.key),
    fresh: fresh.slice(0, newSlots),
    waitingNew: Math.max(0, fresh.length - newSlots),
    waitingReview: Math.max(0, due.length - reviewSlots),
  };
}

/** Vorderste Karte nach der Bewertung: bei "Nochmal" ein paar Karten später erneut, sonst fertig. */
export function requeue(queue: string[], rating: Rating, gap = 3): string[] {
  const [head, ...rest] = queue;
  if (head === undefined) return queue;
  if (rating !== 1) return rest;
  const pos = Math.min(gap, rest.length);
  return [...rest.slice(0, pos), head, ...rest.slice(pos)];
}
