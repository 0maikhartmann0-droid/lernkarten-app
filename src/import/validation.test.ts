import { describe, expect, it } from 'vitest';
import example from '../../examples/beispiel-bauphysik.json';
import { CARD_TYPES } from '../db/types';
import { checkCard, parseDeckJson, validateDeck } from './validation';

const deck = { id: 'test', title: 'Testdeck', subject: 'Bauphysik', created: '2026-10-13' };

const file = (cards: unknown[], overrides: Record<string, unknown> = {}) => ({
  schema: 'lernkarten-deck/v1',
  deck,
  cards,
  ...overrides,
});

const basic = { id: 'c1', type: 'basic', front: 'Frage?', back: 'Antwort' };

function errorsOf(data: unknown): string[] {
  const result = validateDeck(data);
  if (result.ok) throw new Error('Validierung hätte fehlschlagen müssen');
  return result.errors;
}

function valueOf(data: unknown) {
  const result = validateDeck(data);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value;
}

describe('validateDeck', () => {
  it('akzeptiert ein gültiges Deck mit allen Kartentypen', () => {
    const { cards, warnings } = valueOf(
      file([
        basic,
        { id: 'c2', type: 'mc', front: 'F', choices: ['a', 'b'], answer: 1, explain: 'weil' },
        { id: 'c3', type: 'tf', front: 'F', answer: false },
        { id: 'c4', type: 'cloze', front: 'Der {{c1::U-Wert}} …' },
        { id: 'c5', type: 'typed', front: 'F', back: 'dB', tags: ['a', ' a ', ''] },
      ]),
    );
    expect(cards.map((c) => c.type)).toEqual(['basic', 'mc', 'tf', 'cloze', 'typed']);
    expect(cards[1]).toMatchObject({ choices: ['a', 'b'], answer: 1, explain: 'weil' });
    expect(cards[2]?.answer).toBe(false);
    expect(cards[4]?.tags).toEqual(['a']);
    expect(warnings).toEqual([]);
  });

  it('akzeptiert die mitgelieferte Beispieldatei (mind. 12 Karten, alle Typen)', () => {
    const { cards } = valueOf(example);
    expect(cards.length).toBeGreaterThanOrEqual(12);
    expect(new Set(cards.map((c) => c.type))).toEqual(new Set(CARD_TYPES));
  });

  it('meldet ein fehlendes oder falsches Schema', () => {
    expect(errorsOf({ deck, cards: [basic] })[0]).toContain('"schema" fehlt');
    expect(errorsOf(file([basic], { schema: 'anki/v2' }))[0]).toContain('Unbekanntes Schema');
  });

  it('meldet fehlende Deck-Angaben', () => {
    const errors = errorsOf(file([basic], { deck: { subject: 'Statik' } }));
    expect(errors).toContain('Deck: Feld "title" fehlt oder ist leer.');
    expect(errors.some((e) => e.includes('Deck: Feld "id"'))).toBe(true);
  });

  it('meldet eine leere oder fehlende Kartenliste', () => {
    expect(errorsOf(file([]))[0]).toContain('keine Karten');
    expect(errorsOf({ schema: 'lernkarten-deck/v1', deck })[0]).toContain('"cards" fehlt');
  });

  it('nennt Kartennummer und id, wenn "back" fehlt', () => {
    const errors = errorsOf(file([basic, { id: 'c2', type: 'basic', front: 'Frage?' }]));
    expect(errors).toEqual([
      'Karte 2 (id "c2"): Feld "back" (Antwort) fehlt oder ist leer – Pflicht bei Typ "basic".',
    ]);
  });

  it('meldet unbekannte Typen und fehlende Fragen', () => {
    const errors = errorsOf(file([{ id: 'x', type: 'quiz', back: 'A' }]));
    expect(errors[0]).toContain('Unbekannter Typ "quiz"');
    expect(errors[1]).toContain('Feld "front"');
  });

  it('prüft Multiple-Choice-Karten: Liste und Index der Antwort', () => {
    expect(errorsOf(file([{ id: 'm', type: 'mc', front: 'F', answer: 0 }]))[0]).toContain(
      '"choices" fehlt',
    );
    expect(
      errorsOf(file([{ id: 'm', type: 'mc', front: 'F', choices: ['a', 'b'], answer: 2 }]))[0],
    ).toContain('höchstens 1');
    expect(
      errorsOf(file([{ id: 'm', type: 'mc', front: 'F', choices: ['a', 'b'], answer: 'a' }]))[0],
    ).toContain('Index der richtigen Antwort');
    expect(
      errorsOf(file([{ id: 'm', type: 'mc', front: 'F', choices: ['a'], answer: 0 }]))[0],
    ).toContain('mindestens 2');
  });

  it('verlangt bei Richtig/Falsch einen echten Wahrheitswert', () => {
    const errors = errorsOf(file([{ id: 't', type: 'tf', front: 'F', answer: 'true' }]));
    expect(errors[0]).toContain('true oder false');
  });

  it('verlangt bei Lückentext mindestens eine Lücke', () => {
    const errors = errorsOf(file([{ id: 'l', type: 'cloze', front: 'Ohne Lücke.' }]));
    expect(errors[0]).toContain('Lückentext ohne Lücke');
  });

  it('meldet doppelte IDs mit der Position der ersten Karte', () => {
    const errors = errorsOf(file([basic, { ...basic, front: 'Andere Frage?' }]));
    expect(errors[0]).toContain('doppelt vergeben (bereits bei Karte 1)');
  });

  it('sammelt alle Fehler statt beim ersten abzubrechen', () => {
    const errors = errorsOf(
      file([{ id: 'a', type: 'basic', front: 'F' }, { id: 'b', type: 'tf', front: 'F' }, 'kaputt']),
    );
    expect(errors).toHaveLength(3);
    expect(errors[2]).toContain('Karte 3');
  });

  it('vergibt stabile IDs für Karten ohne id und warnt', () => {
    const card = { type: 'basic', front: 'Frage?', back: 'Antwort' };
    const first = valueOf(file([card]));
    const second = valueOf(file([{ ...card, back: 'Geänderte Antwort' }]));
    expect(first.cards[0]?.id).toMatch(/^auto-[0-9a-f]{8}$/);
    expect(second.cards[0]?.id).toBe(first.cards[0]?.id);
    expect(first.warnings[0]).toContain('ohne "id"');
  });

  it('ergänzt fehlende optionale Deck-Felder', () => {
    const { deck: meta } = valueOf(file([basic], { deck: { id: 'x', title: 'X' } }));
    expect(meta.subject).toBe('');
    expect(meta.created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('parseDeckJson', () => {
  it('liest JSON mit BOM und Markdown-Codezaun aus dem Chat', () => {
    const json = JSON.stringify(file([basic]));
    expect(parseDeckJson(String.fromCharCode(0xfeff) + json).ok).toBe(true);
    expect(parseDeckJson('```json\n' + json + '\n```').ok).toBe(true);
  });

  it('nennt bei kaputtem JSON die Zeile', () => {
    const result = parseDeckJson('{\n  "schema": "lernkarten-deck/v1",\n  "deck": {,}\n}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Kein gültiges JSON: Fehler in Zeile 3/);
  });

  it('meldet eine leere Datei', () => {
    expect(parseDeckJson('  \n')).toEqual({ ok: false, errors: ['Die Datei ist leer.'] });
  });
});

describe('checkCard', () => {
  it('prüft eine einzelne Karte nach den Import-Regeln', () => {
    expect(checkCard({ type: 'basic', front: 'F', back: 'A', tags: ['x'] })).toEqual({
      ok: true,
      card: { type: 'basic', front: 'F', back: 'A', tags: ['x'] },
    });
    expect(checkCard({ type: 'mc', front: 'F', choices: ['a', ''], answer: 0 })).toEqual({
      ok: false,
      errors: ['Antwortmöglichkeit 2 in "choices" ist kein Text oder leer.'],
    });
  });
});
