import { describe, expect, it } from 'vitest';
import { dayNumber } from './day';
import { buildQueue, requeue } from './queue';
import type { SrsState } from './sm2';
import { accuracy, streak } from './stats';

const TODAY = 20_000;

const state = (due: number, interval: number): SrsState => ({
  ease: 2.5,
  interval,
  due,
  reps: interval > 0 ? 2 : 0,
  lapses: 0,
});

describe('buildQueue', () => {
  const order = ['a', 'b', 'c', 'd', 'e', 'f'];
  const states = new Map<string, SrsState>([
    ['a', state(TODAY - 1, 6)],
    ['b', state(TODAY - 5, 10)],
    ['c', state(TODAY + 3, 6)],
    ['d', state(TODAY, 0)],
  ]);

  it('trennt Lernkarten, fällige und neue Karten', () => {
    const queue = buildQueue({ order, states, today: TODAY, newSlots: 10, reviewSlots: 10 });
    expect(queue.learning).toEqual(['d']);
    expect(queue.review).toEqual(['b', 'a']);
    expect(queue.fresh).toEqual(['e', 'f']);
    expect(queue.waitingNew).toBe(0);
    expect(queue.waitingReview).toBe(0);
  });

  it('hält die Tageslimits ein und meldet, was wartet', () => {
    const queue = buildQueue({ order, states, today: TODAY, newSlots: 1, reviewSlots: 1 });
    expect(queue.review).toEqual(['b']);
    expect(queue.fresh).toEqual(['e']);
    expect(queue.waitingNew).toBe(1);
    expect(queue.waitingReview).toBe(1);
  });

  it('zeigt Lernkarten auch bei ausgeschöpften Limits', () => {
    const queue = buildQueue({ order, states, today: TODAY, newSlots: 0, reviewSlots: -3 });
    expect(queue.learning).toEqual(['d']);
    expect(queue.review).toEqual([]);
    expect(queue.fresh).toEqual([]);
  });
});

describe('requeue', () => {
  it('entfernt die Karte nach einer bestandenen Bewertung', () => {
    expect(requeue(['a', 'b', 'c'], 3)).toEqual(['b', 'c']);
  });

  it('zeigt die Karte bei "Nochmal" drei Karten später erneut', () => {
    expect(requeue(['a', 'b', 'c', 'd', 'e'], 1)).toEqual(['b', 'c', 'd', 'a', 'e']);
  });

  it('hängt die Karte ans Ende, wenn weniger Karten übrig sind', () => {
    expect(requeue(['a', 'b'], 1)).toEqual(['b', 'a']);
    expect(requeue(['a'], 1)).toEqual(['a']);
  });
});

describe('Statistik', () => {
  it('zählt Lerntage in Folge bis heute', () => {
    expect(streak([TODAY, TODAY - 1, TODAY - 2, TODAY - 4], TODAY)).toBe(3);
  });

  it('lässt den Streak bestehen, solange heute noch nicht gelernt wurde', () => {
    expect(streak([TODAY - 1, TODAY - 2], TODAY)).toBe(2);
    expect(streak([TODAY - 2], TODAY)).toBe(0);
  });

  it('berechnet die Trefferquote ohne "Nochmal"', () => {
    expect(accuracy([1, 2, 3, 4])).toBe(0.75);
    expect(accuracy([])).toBeNull();
  });
});

describe('dayNumber', () => {
  it('wechselt um Mitternacht Ortszeit', () => {
    const late = new Date(2026, 9, 13, 23, 59);
    const early = new Date(2026, 9, 14, 0, 1);
    expect(dayNumber(early)).toBe(dayNumber(late) + 1);
    expect(dayNumber(new Date(2026, 9, 13, 0, 0))).toBe(dayNumber(late));
  });
});
