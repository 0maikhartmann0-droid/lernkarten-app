import { describe, expect, it } from 'vitest';
import { filterCards, foldText, tagCounts } from './search';
import type { Card } from './types';

const make = (id: string, content: Partial<Card>): Card => ({
  id,
  key: `d::${id}`,
  deckId: 'd',
  order: 0,
  type: 'basic',
  front: '',
  tags: [],
  ...content,
});

const cards = [
  make('1', {
    front: 'Was ist die Wärmeleitfähigkeit?',
    back: 'W/(m·K)',
    tags: ['waerme', 'einheiten'],
  }),
  make('2', {
    type: 'mc',
    front: 'Einheit U-Wert?',
    choices: ['W/(m²·K)', 'm²K/W'],
    answer: 0,
    tags: ['waerme'],
  }),
  make('3', {
    type: 'tf',
    front: 'Schall breitet sich im Vakuum aus.',
    answer: false,
    explain: 'Kein Medium',
    tags: ['schall'],
  }),
];

describe('Suche', () => {
  const all = { query: '', tags: [], type: '' } as const;
  const ids = (list: Card[]) => list.map((c) => c.id);

  it('findet ohne Rücksicht auf Groß-/Kleinschreibung und Umlaute', () => {
    expect(foldText('  Wärme  LEITFÄHIGKEIT ')).toBe('waerme leitfaehigkeit');
    expect(ids(filterCards(cards, { ...all, query: 'waermeleit' }))).toEqual(['1']);
    expect(ids(filterCards(cards, { ...all, query: 'WÄRMELEIT' }))).toEqual(['1']);
  });

  it('durchsucht auch Antworten, Antwortmöglichkeiten und Erklärungen', () => {
    expect(ids(filterCards(cards, { ...all, query: 'm²K/W' }))).toEqual(['2']);
    expect(ids(filterCards(cards, { ...all, query: 'medium' }))).toEqual(['3']);
  });

  it('verlangt alle Suchwörter in beliebiger Reihenfolge', () => {
    expect(ids(filterCards(cards, { ...all, query: 'wert einheit' }))).toEqual(['2']);
    expect(filterCards(cards, { ...all, query: 'einheit vakuum' })).toEqual([]);
  });

  it('filtert nach allen gewählten Tags und nach Typ', () => {
    expect(ids(filterCards(cards, { ...all, tags: ['waerme'] }))).toEqual(['1', '2']);
    expect(ids(filterCards(cards, { ...all, tags: ['waerme', 'einheiten'] }))).toEqual(['1']);
    expect(ids(filterCards(cards, { ...all, type: 'tf' }))).toEqual(['3']);
  });

  it('zählt Tags, häufigste zuerst', () => {
    expect(tagCounts(cards)).toEqual([
      ['waerme', 2],
      ['einheiten', 1],
      ['schall', 1],
    ]);
  });
});
