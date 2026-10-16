import { describe, expect, it } from 'vitest';
import type { Card, CardContent } from '../db/types';
import { buildQuestion, buildQuiz, countEligible, reshuffle, shuffle } from './quiz';

/** Deterministische Zufallsfolge für reproduzierbare Tests. */
function seeded(seed = 1) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

let order = 0;
function card(content: Partial<CardContent> & { id: string }, deckId = 'd1'): Card {
  return {
    type: 'basic',
    front: `Frage ${content.id}`,
    tags: [],
    ...content,
    key: `${deckId}::${content.id}`,
    deckId,
    order: order++,
  };
}

const basics = [
  card({ id: 'b1', back: 'Antwort 1', tags: ['waerme'] }),
  card({ id: 'b2', back: 'Antwort 2', tags: ['waerme'] }),
  card({ id: 'b3', back: 'Antwort 3', tags: ['schall'] }),
  card({ id: 'b4', back: 'Antwort 4', tags: ['waerme'] }),
  card({ id: 'b5', back: 'Antwort 5', tags: ['schall'] }),
];

describe('shuffle', () => {
  it('mischt eine Kopie und verliert keine Einträge', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const output = shuffle(input, seeded());
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...output].sort()).toEqual(input);
  });
});

describe('buildQuestion', () => {
  it('mischt Multiple-Choice-Antworten und behält die richtige', () => {
    const mc = card({ id: 'm', type: 'mc', choices: ['A', 'B', 'C', 'D'], answer: 2 });
    for (let seed = 1; seed < 20; seed++) {
      const q = buildQuestion(mc, 'mc', [mc], seeded(seed));
      if (q?.kind !== 'choice') throw new Error('Multiple Choice erwartet');
      expect([...q.options].sort()).toEqual(['A', 'B', 'C', 'D']);
      expect(q.options[q.correct]).toBe('C');
    }
  });

  it('macht aus einer Karteikarte Multiple Choice mit Antworten anderer Karten des Decks', () => {
    const q = buildQuestion(basics[0]!, 'mc', basics, seeded());
    if (q?.kind !== 'choice') throw new Error('Multiple Choice erwartet');
    expect(q.options).toHaveLength(4);
    expect(q.options[q.correct]).toBe('Antwort 1');
    expect(new Set(q.options).size).toBe(4);
  });

  it('bevorzugt falsche Antworten mit gemeinsamen Tags', () => {
    const q = buildQuestion(basics[0]!, 'mc', basics, seeded());
    if (q?.kind !== 'choice') throw new Error('Multiple Choice erwartet');
    expect(q.options).toContain('Antwort 2');
    expect(q.options).toContain('Antwort 4');
  });

  it('nimmt keine falsche Antwort, die der richtigen gleicht, und keine anderen Kartentypen', () => {
    const same = card({ id: 'x', back: ' antwort 1 ' });
    const typed = card({ id: 't', type: 'typed', back: 'Kurz' });
    const q = buildQuestion(
      basics[0]!,
      'mc',
      [basics[0]!, same, typed, basics[1]!, basics[2]!],
      seeded(),
    );
    if (q?.kind !== 'choice') throw new Error('Multiple Choice erwartet');
    expect(q.options).toHaveLength(3);
    expect(q.options).not.toContain('Kurz');
    expect(q.options).not.toContain(' antwort 1 ');
  });

  it('fällt bei zu wenigen anderen Antworten auf Selbstbewertung zurück (nur im gemischten Modus)', () => {
    const pair = [basics[0]!, basics[1]!];
    expect(buildQuestion(basics[0]!, 'mc', pair, seeded())).toBeNull();
    expect(buildQuestion(basics[0]!, 'gemischt', pair, seeded())?.kind).toBe('self');
  });

  it('nummeriert Lücken und behält Hinweise', () => {
    const cloze = card({
      id: 'c',
      type: 'cloze',
      front: 'Je {{c1::kleiner::Richtung}}, desto {{c2::besser}}.',
    });
    const q = buildQuestion(cloze, 'cloze', [cloze], seeded());
    if (q?.kind !== 'cloze') throw new Error('Lückentext erwartet');
    expect(q.gaps).toEqual([{ answer: 'kleiner', hint: 'Richtung' }, { answer: 'besser' }]);
    expect(q.prompt).toBe(
      'Je <mark class="cloze gap">[1: Richtung]</mark>, desto <mark class="cloze gap">[2]</mark>.',
    );
  });

  it('lässt Lücken mit Formeln selbst bewerten', () => {
    const cloze = card({ id: 'c', type: 'cloze', front: '$s_d$ = {{c1::$\\mu \\cdot d$}}' });
    expect(buildQuestion(cloze, 'cloze', [cloze], seeded())?.kind).toBe('self');
  });

  it('fragt jeden Typ nur in passenden Modi ab', () => {
    const tf = card({ id: 'tf', type: 'tf', answer: false });
    const typed = card({ id: 'ty', type: 'typed', back: 'dB' });
    expect(buildQuestion(tf, 'mc', [tf], seeded())).toBeNull();
    expect(buildQuestion(tf, 'tf', [tf], seeded())).toMatchObject({ kind: 'tf', answer: false });
    expect(buildQuestion(typed, 'typed', [typed], seeded())).toMatchObject({
      kind: 'typed',
      answer: 'dB',
    });
    expect(buildQuestion(basics[0]!, 'typed', basics, seeded())).toBeNull();
    expect(buildQuestion(basics[0]!, 'tf', basics, seeded())).toBeNull();
  });
});

describe('buildQuiz', () => {
  const tfs = [1, 2, 3].map((n) => card({ id: `tf${n}`, type: 'tf', answer: true }));
  const all = [...basics, ...tfs];

  it('liefert höchstens die gewünschte Anzahl passender Fragen ohne Wiederholung', () => {
    const quiz = buildQuiz(all, 'tf', 10, seeded());
    expect(quiz).toHaveLength(3);
    expect(new Set(quiz.map((q) => q.card.key)).size).toBe(3);
    expect(buildQuiz(all, 'gemischt', 4, seeded())).toHaveLength(4);
  });

  it('wählt falsche Antworten nur aus demselben Deck', () => {
    const other = [1, 2, 3].map((n) => card({ id: `o${n}`, back: `Fremd ${n}` }, 'd2'));
    for (const q of buildQuiz([...basics, ...other], 'mc', 10, seeded(7))) {
      if (q.kind !== 'choice') continue;
      const fromOtherDeck = q.options.some((o) => o.startsWith('Fremd'));
      expect(fromOtherDeck).toBe(q.card.deckId === 'd2');
    }
  });

  it('zählt, wie viele Karten in einen Modus passen', () => {
    expect(countEligible(all, 'mc')).toBe(5);
    expect(countEligible(all, 'tf')).toBe(3);
    expect(countEligible(all, 'cloze')).toBe(0);
    expect(countEligible(all, 'gemischt')).toBe(8);
  });
});

describe('reshuffle', () => {
  it('mischt die Antworten neu und behält die richtige', () => {
    const q = buildQuestion(basics[0]!, 'mc', basics, seeded());
    if (q?.kind !== 'choice') throw new Error('Multiple Choice erwartet');
    for (let seed = 1; seed < 10; seed++) {
      const again = reshuffle(q, seeded(seed));
      if (again.kind !== 'choice') throw new Error('Multiple Choice erwartet');
      expect(again.options[again.correct]).toBe('Antwort 1');
      expect([...again.options].sort()).toEqual([...q.options].sort());
    }
  });
});
