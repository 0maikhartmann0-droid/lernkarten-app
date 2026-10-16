import type { Card } from '../db/types';
import { clozeBack, clozeFront, parseCloze } from './cloze';
import { normalizeAnswer } from './typed';

export type QuizMode = 'gemischt' | 'mc' | 'tf' | 'cloze' | 'typed';

export const QUIZ_MODES: readonly { mode: QuizMode; label: string; hint: string }[] = [
  { mode: 'gemischt', label: 'Gemischt', hint: 'Jede Karte in ihrer passenden Form' },
  {
    mode: 'mc',
    label: 'Multiple Choice',
    hint: 'Auch Karteikarten – mit Antworten anderer Karten',
  },
  { mode: 'tf', label: 'Richtig/Falsch', hint: 'Aussagen beurteilen' },
  { mode: 'cloze', label: 'Lückentext', hint: 'Lücken eintippen' },
  { mode: 'typed', label: 'Freitext', hint: 'Antwort eintippen' },
];

export interface Gap {
  answer: string;
  hint?: string;
}

export type Question =
  | { kind: 'choice'; card: Card; prompt: string; options: string[]; correct: number }
  | { kind: 'tf'; card: Card; prompt: string; answer: boolean }
  | { kind: 'cloze'; card: Card; prompt: string; solution: string; gaps: Gap[] }
  | { kind: 'typed'; card: Card; prompt: string; answer: string }
  | { kind: 'self'; card: Card; front: string; back: string };

/** Zufallsquelle wie Math.random – in Tests austauschbar. */
export type Random = () => number;

const MAX_DISTRACTORS = 3;
const MIN_DISTRACTORS = 2;

export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Baut die Frage für eine Karte im gewählten Modus oder null, wenn die Karte dort nicht passt.
 * deckCards sind die Karten desselben Decks – daraus kommen falsche Antworten für Karteikarten.
 */
export function buildQuestion(
  card: Card,
  mode: QuizMode,
  deckCards: readonly Card[],
  random: Random,
): Question | null {
  const mixed = mode === 'gemischt';
  switch (card.type) {
    case 'mc':
      return mixed || mode === 'mc' ? choiceFromMc(card, random) : null;
    case 'tf':
      return mixed || mode === 'tf'
        ? { kind: 'tf', card, prompt: card.front, answer: card.answer === true }
        : null;
    case 'cloze':
      return mixed || mode === 'cloze' ? clozeQuestion(card) : null;
    case 'typed':
      if (mixed || mode === 'typed') {
        return { kind: 'typed', card, prompt: card.front, answer: card.back ?? '' };
      }
      return mode === 'mc' ? choiceFromAnswers(card, deckCards, random) : null;
    case 'basic':
      if (mode === 'mc') return choiceFromAnswers(card, deckCards, random);
      if (mixed) return choiceFromAnswers(card, deckCards, random) ?? selfCheck(card);
      return null;
  }
}

/** Zieht bis zu count Fragen in zufälliger Reihenfolge aus den Karten. */
export function buildQuiz(
  cards: readonly Card[],
  mode: QuizMode,
  count: number,
  random: Random,
): Question[] {
  const byDeck = groupByDeck(cards);
  const questions: Question[] = [];
  for (const card of shuffle(cards, random)) {
    if (questions.length >= count) break;
    const question = buildQuestion(card, mode, byDeck.get(card.deckId) ?? [], random);
    if (question) questions.push(question);
  }
  return questions;
}

/** Wie viele der Karten sich im Modus abfragen lassen. */
export function countEligible(cards: readonly Card[], mode: QuizMode): number {
  const byDeck = groupByDeck(cards);
  return cards.filter((card) => buildQuestion(card, mode, byDeck.get(card.deckId) ?? [], () => 0))
    .length;
}

function groupByDeck(cards: readonly Card[]): Map<string, Card[]> {
  const byDeck = new Map<string, Card[]>();
  for (const card of cards) {
    const list = byDeck.get(card.deckId);
    if (list) list.push(card);
    else byDeck.set(card.deckId, [card]);
  }
  return byDeck;
}

// Die Reihenfolge wird gemischt, damit man sich nicht die Position der richtigen Antwort merkt.
function choiceFromMc(card: Card, random: Random): Question | null {
  const choices = card.choices ?? [];
  const correctText = typeof card.answer === 'number' ? choices[card.answer] : undefined;
  if (correctText === undefined) return null;
  const order = shuffle(
    choices.map((_, i) => i),
    random,
  );
  return {
    kind: 'choice',
    card,
    prompt: card.front,
    options: order.map((i) => choices[i]!),
    correct: order.indexOf(card.answer as number),
  };
}

// Falsche Antworten sind Rückseiten anderer Karten gleichen Typs aus demselben Deck – bevorzugt
// solche mit gemeinsamen Tags, weil sie zum selben Thema gehören und damit plausibler sind.
function choiceFromAnswers(
  card: Card,
  deckCards: readonly Card[],
  random: Random,
): Question | null {
  const correct = card.back;
  if (!correct) return null;
  const seen = new Set([normalizeAnswer(correct)]);
  const candidates: { text: string; shared: number; tiebreak: number }[] = [];
  for (const other of deckCards) {
    if (other.key === card.key || other.type !== card.type || !other.back) continue;
    const normalized = normalizeAnswer(other.back);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push({
      text: other.back,
      shared: other.tags.filter((t) => card.tags.includes(t)).length,
      tiebreak: random(),
    });
  }
  if (candidates.length < MIN_DISTRACTORS) return null;
  const distractors = candidates
    .sort((a, b) => b.shared - a.shared || a.tiebreak - b.tiebreak)
    .slice(0, MAX_DISTRACTORS)
    .map((c) => c.text);
  const options = shuffle([correct, ...distractors], random);
  return { kind: 'choice', card, prompt: card.front, options, correct: options.indexOf(correct) };
}

// Lücken mit Formeln lassen sich nicht sinnvoll eintippen – solche Karten werden selbst bewertet.
function clozeQuestion(card: Card): Question {
  const segments = parseCloze(card.front);
  const gaps: Gap[] = [];
  let prompt = '';
  for (const segment of segments) {
    if (segment.kind === 'text') {
      prompt += segment.text;
      continue;
    }
    gaps.push(
      segment.hint ? { answer: segment.answer, hint: segment.hint } : { answer: segment.answer },
    );
    const label = segment.hint ? `${gaps.length}: ${segment.hint}` : String(gaps.length);
    prompt += `<mark class="cloze gap">[${label}]</mark>`;
  }
  if (gaps.some((g) => /[$\\]/.test(g.answer))) {
    return { kind: 'self', card, front: clozeFront(card.front), back: clozeBack(card.front) };
  }
  return { kind: 'cloze', card, prompt, solution: clozeBack(card.front), gaps };
}

function selfCheck(card: Card): Question {
  return { kind: 'self', card, front: card.front, back: card.back ?? '' };
}

/** Dieselbe Frage mit neu gemischten Antwortmöglichkeiten. */
export function reshuffle(question: Question, random: Random): Question {
  if (question.kind !== 'choice') return question;
  const correctText = question.options[question.correct]!;
  const options = shuffle(question.options, random);
  return { ...question, options, correct: options.indexOf(correctText) };
}
