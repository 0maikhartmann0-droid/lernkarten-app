import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDeckJson } from '../src/import/validation';
import { buildQuestion } from '../src/modes/quiz';
import type { Card } from '../src/db/types';

// Prüft eine Deck-Datei außerhalb des Projekts: DECK_FILE=<Pfad> npx vitest run tests/deckfile.test.ts
const file = process.env.DECK_FILE;

describe.runIf(file)('Deck-Datei', () => {
  it('ist gültig und jede Karte lässt sich im gemischten Quiz abfragen', () => {
    const result = parseDeckJson(readFileSync(file!, 'utf8'));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const { deck, cards, warnings } = result.value;
    expect(warnings).toEqual([]);
    const full: Card[] = cards.map((c, order) => ({
      ...c,
      key: `${deck.id}::${c.id}`,
      deckId: deck.id,
      order,
    }));
    const kinds: Record<string, number> = {};
    for (const card of full) {
      const q = buildQuestion(card, 'gemischt', full, () => 0.5);
      expect(q).not.toBeNull();
      kinds[q!.kind] = (kinds[q!.kind] ?? 0) + 1;
    }
    const types: Record<string, number> = {};
    for (const c of cards) types[c.type] = (types[c.type] ?? 0) + 1;
    const tags: Record<string, number> = {};
    for (const c of cards) for (const t of c.tags) tags[t] = (tags[t] ?? 0) + 1;
    console.log(
      JSON.stringify({ karten: cards.length, typen: types, quizFormen: kinds, tags }, null, 1),
    );
  });
});
