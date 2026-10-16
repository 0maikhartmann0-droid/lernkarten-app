import { describe, expect, it } from 'vitest';
import {
  MIN_EASE,
  START_EASE,
  formatInterval,
  newState,
  previewIntervals,
  schedule,
  type Rating,
  type SrsState,
} from './sm2';

const TODAY = 20_000;

const reviewed = (overrides: Partial<SrsState> = {}): SrsState => ({
  ease: 2.5,
  interval: 10,
  due: TODAY,
  reps: 3,
  lapses: 0,
  ...overrides,
});

describe('schedule (SM-2)', () => {
  it('startet neue Karten mit Faktor 2,5 und ohne Abstand', () => {
    expect(newState(TODAY)).toEqual({
      ease: START_EASE,
      interval: 0,
      due: TODAY,
      reps: 0,
      lapses: 0,
    });
  });

  it('plant eine neue Karte bei "Gut" für morgen', () => {
    expect(schedule(newState(TODAY), 3, TODAY)).toEqual({
      ease: 2.5,
      interval: 1,
      due: TODAY + 1,
      reps: 1,
      lapses: 0,
    });
  });

  it('plant eine neue Karte bei "Leicht" in vier Tagen und erhöht den Faktor', () => {
    const next = schedule(newState(TODAY), 4, TODAY);
    expect(next.interval).toBe(4);
    expect(next.ease).toBe(2.6);
  });

  it('gibt bei der zweiten erfolgreichen Wiederholung sechs Tage', () => {
    const first = schedule(newState(TODAY), 3, TODAY);
    const second = schedule(first, 3, TODAY + 1);
    expect(second.interval).toBe(6);
    expect(second.due).toBe(TODAY + 7);
    expect(second.reps).toBe(2);
  });

  it('multipliziert danach den Abstand mit dem Faktor', () => {
    expect(schedule(reviewed({ interval: 6, reps: 2 }), 3, TODAY).interval).toBe(15);
  });

  it('lässt den Faktor bei "Gut" unverändert', () => {
    expect(schedule(reviewed(), 3, TODAY).ease).toBe(2.5);
  });

  it('senkt den Faktor bei "Schwer" und verlängert nur wenig', () => {
    const next = schedule(reviewed(), 2, TODAY);
    expect(next.ease).toBe(2.36);
    expect(next.interval).toBe(12);
  });

  it('setzt bei "Nochmal" zurück: heute fällig, Wiederholungen 0, ein Lapse mehr', () => {
    expect(schedule(reviewed({ lapses: 1 }), 1, TODAY)).toEqual({
      ease: 2.3,
      interval: 0,
      due: TODAY,
      reps: 0,
      lapses: 2,
    });
  });

  it('zählt "Nochmal" bei einer noch nie gekonnten Karte nicht als Lapse', () => {
    expect(schedule(newState(TODAY), 1, TODAY).lapses).toBe(0);
  });

  it('unterschreitet den Mindestfaktor 1,3 nie', () => {
    let state = reviewed({ ease: 1.4 });
    for (let i = 0; i < 5; i++) state = schedule(state, 1, TODAY);
    expect(state.ease).toBe(MIN_EASE);
    expect(schedule(reviewed({ ease: 1.3 }), 2, TODAY).ease).toBe(MIN_EASE);
  });

  it('ordnet die Abstände immer Schwer ≤ Gut < Leicht', () => {
    const states = [
      newState(TODAY),
      reviewed({ interval: 1, reps: 1 }),
      reviewed({ interval: 4, reps: 1 }),
      reviewed({ interval: 2, reps: 2, ease: 1.3 }),
      reviewed({ interval: 120, reps: 8 }),
    ];
    for (const state of states) {
      const preview = previewIntervals(state, TODAY);
      expect(preview[1]).toBe(0);
      expect(preview[2]).toBeGreaterThanOrEqual(1);
      expect(preview[2]).toBeLessThanOrEqual(preview[3]);
      expect(preview[3]).toBeLessThan(preview[4]);
    }
  });

  it('verlängert den Abstand bei jeder bestandenen Wiederholung um mindestens einen Tag', () => {
    for (const rating of [2, 3, 4] as Rating[]) {
      const state = reviewed({ interval: 1, reps: 5, ease: 1.3 });
      expect(schedule(state, rating, TODAY).interval).toBeGreaterThan(state.interval);
    }
  });

  it('verändert den übergebenen Zustand nicht', () => {
    const state = reviewed();
    const copy = { ...state };
    schedule(state, 4, TODAY);
    expect(state).toEqual(copy);
  });
});

describe('formatInterval', () => {
  it('beschriftet Abstände lesbar auf Deutsch', () => {
    expect(formatInterval(0)).toBe('gleich');
    expect(formatInterval(1)).toBe('1 Tag');
    expect(formatInterval(6)).toBe('6 Tage');
    expect(formatInterval(45)).toBe('1,5 Mon.');
    expect(formatInterval(730)).toBe('2 J.');
  });
});
