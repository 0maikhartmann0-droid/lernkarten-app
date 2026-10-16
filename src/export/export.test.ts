import { describe, expect, it } from 'vitest';
import example from '../../examples/beispiel-bauphysik.json';
import type { Card, Deck } from '../db/types';
import { validateDeck } from '../import/validation';
import { ankiSides, toAnkiField, toAnkiTsv } from './ankiTsv';
import { exportFileName, sameContent, toDeckFile } from './deckJson';

function exampleDeck(): { deck: Deck; cards: Card[] } {
  const result = validateDeck(example);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  const { deck: meta, cards } = result.value;
  const deck: Deck = { ...meta, importedAt: 0, updatedAt: 0 };
  return {
    deck,
    cards: cards.map((c, order) => ({ ...c, key: `${deck.id}::${c.id}`, deckId: deck.id, order })),
  };
}

describe('Export als Deck-JSON', () => {
  it('lässt sich unverändert wieder importieren', () => {
    const { deck, cards } = exampleDeck();
    const file = JSON.parse(JSON.stringify(toDeckFile(deck, [...cards].reverse())));
    const again = validateDeck(file);
    if (!again.ok) throw new Error(again.errors.join('\n'));
    expect(again.value.deck).toMatchObject({
      id: deck.id,
      title: deck.title,
      subject: 'Bauphysik',
    });
    expect(again.value.cards).toHaveLength(cards.length);
    again.value.cards.forEach((c, i) => expect(sameContent(c, cards[i]!)).toBe(true));
  });

  it('schreibt nur die Felder des Kartentyps', () => {
    const { deck } = exampleDeck();
    const card: Card = {
      key: 'x::a',
      deckId: 'x',
      order: 0,
      id: 'a',
      type: 'tf',
      front: 'Aussage',
      back: 'Rest von früher',
      answer: false,
      tags: [],
      editedAt: 5,
    };
    expect(toDeckFile(deck, [card]).cards[0]).toEqual({
      id: 'a',
      type: 'tf',
      front: 'Aussage',
      answer: false,
    });
  });

  it('erkennt gleichen und geänderten Inhalt', () => {
    const base = { id: 'a', type: 'basic' as const, front: 'F', back: 'A', tags: ['x'] };
    expect(sameContent(base, { ...base })).toBe(true);
    expect(sameContent(base, { ...base, back: 'B' })).toBe(false);
    expect(sameContent(base, { ...base, tags: [] })).toBe(false);
  });

  it('benennt die Datei nach dem Deck', () => {
    const { deck } = exampleDeck();
    expect(exportFileName(deck, 'json')).toBe('beispiel-bauphysik-grundlagen.json');
  });
});

describe('Export für Anki', () => {
  it('schreibt Kopfzeilen und eine Zeile pro Karte mit Tags', () => {
    const { cards } = exampleDeck();
    const lines = toAnkiTsv(cards).trimEnd().split('\n');
    expect(lines.slice(0, 3)).toEqual(['#separator:tab', '#html:true', '#tags column:3']);
    expect(lines).toHaveLength(3 + cards.length);
    for (const line of lines.slice(3)) expect(line.split('\t')).toHaveLength(3);
    expect(lines[3]!.split('\t')[2]).toBe('beispiel waermeschutz');
  });

  it('macht aus Formeln MathJax und aus Umbrüchen <br>, ohne Tabs im Feld', () => {
    expect(toAnkiField('Formel: $R = \\frac{d}{\\lambda}$\n\n$$U = 1/R_T$$')).toBe(
      'Formel: \\(R = \\frac{d}{\\lambda}\\)<br><br>\\[U = 1/R_T\\]',
    );
    expect(toAnkiField('a\tb <c> & **fett** und *kursiv*')).toBe(
      'a b &lt;c&gt; &amp; <b>fett</b> und <i>kursiv</i>',
    );
  });

  it('bildet alle Kartentypen auf Vorder- und Rückseite ab', () => {
    const base = { id: 'a', tags: [] };
    expect(
      ankiSides({ ...base, type: 'mc', front: 'Einheit?', choices: ['W', 'J'], answer: 1 }),
    ).toEqual({ front: 'Einheit?\n\nA) W\nB) J', back: 'B) J' });
    expect(ankiSides({ ...base, type: 'tf', front: 'Aussage', answer: false })).toEqual({
      front: 'Aussage\n\n(Richtig oder falsch?)',
      back: 'Falsch',
    });
    expect(
      ankiSides({ ...base, type: 'cloze', front: 'Je {{c1::kleiner}}, desto {{c2::besser::?}}' }),
    ).toEqual({ front: 'Je […], desto [?]', back: 'Je **kleiner**, desto **besser**' });
    expect(
      ankiSides({
        ...base,
        type: 'basic',
        front: 'F',
        back: 'A',
        explain: 'Weil',
        source: 'Folie 3',
      }),
    ).toEqual({ front: 'F', back: 'A\n\nWeil\n\nQuelle: Folie 3' });
  });
});
