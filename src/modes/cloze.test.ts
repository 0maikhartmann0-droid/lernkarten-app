import { describe, expect, it } from 'vitest';
import type { CardContent } from '../db/types';
import { clozeBack, clozeFront, hasCloze, parseCloze } from './cloze';
import { cardFaces } from './flashcards';

describe('parseCloze', () => {
  it('zerlegt Text und Lücke', () => {
    expect(parseCloze('Der U-Wert ist der Kehrwert von {{c1::R_T}}.')).toEqual([
      { kind: 'text', text: 'Der U-Wert ist der Kehrwert von ' },
      { kind: 'cloze', index: 1, answer: 'R_T' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('liest mehrere Lücken und Hinweise', () => {
    const clozes = parseCloze('{{c1::kleiner::Richtung}} und {{c2::besser}}').filter(
      (s) => s.kind === 'cloze',
    );
    expect(clozes).toEqual([
      { kind: 'cloze', index: 1, answer: 'kleiner', hint: 'Richtung' },
      { kind: 'cloze', index: 2, answer: 'besser' },
    ]);
  });

  it('übersteht geschweifte Klammern aus LaTeX in der Antwort', () => {
    const segments = parseCloze('$U$ = {{c1::$\\frac{1}{\\sqrt{R_T}}$}} gilt');
    expect(segments[1]).toEqual({ kind: 'cloze', index: 1, answer: '$\\frac{1}{\\sqrt{R_T}}$' });
    expect(segments[2]).toEqual({ kind: 'text', text: ' gilt' });
  });

  it('lässt unvollständige Markierungen als Text stehen', () => {
    expect(parseCloze('Offen {{c1::ohne Ende')).toEqual([
      { kind: 'text', text: 'Offen {{c1::ohne Ende' },
    ]);
    expect(hasCloze('Offen {{c1::ohne Ende')).toBe(false);
    expect(hasCloze('Leer {{c1::}}')).toBe(false);
    expect(hasCloze('Voll {{c1::ja}}')).toBe(true);
  });

  it('verdeckt Lücken auf der Vorderseite und füllt sie auf der Rückseite', () => {
    const text = 'Je {{c1::kleiner::?}} desto {{c2::besser}}.';
    expect(clozeFront(text)).toBe(
      'Je <mark class="cloze gap">[?]</mark> desto <mark class="cloze gap">[…]</mark>.',
    );
    expect(clozeBack(text)).toBe(
      'Je <mark class="cloze">kleiner</mark> desto <mark class="cloze">besser</mark>.',
    );
  });
});

describe('cardFaces', () => {
  const card = (content: Partial<CardContent>): CardContent => ({
    id: 'c',
    type: 'basic',
    front: 'Frage',
    tags: [],
    ...content,
  });

  it('zeigt bei Multiple Choice alle Antworten vorn und die richtige hinten', () => {
    const faces = cardFaces(card({ type: 'mc', choices: ['eins', 'zwei'], answer: 1 }));
    expect(faces.front).toBe('Frage\n\n- **A)** eins\n- **B)** zwei');
    expect(faces.back).toBe('**B)** zwei');
  });

  it('zeigt bei Richtig/Falsch die Lösung als Wort', () => {
    expect(cardFaces(card({ type: 'tf', answer: true })).back).toBe('**Richtig**');
    expect(cardFaces(card({ type: 'tf', answer: false })).back).toBe('**Falsch**');
  });

  it('nutzt bei basic und typed Vorder- und Rückseite direkt', () => {
    expect(cardFaces(card({ back: 'Antwort' }))).toEqual({ front: 'Frage', back: 'Antwort' });
    expect(cardFaces(card({ type: 'typed', back: 'dB' })).back).toBe('dB');
  });
});
