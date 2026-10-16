import { db } from './db';
import { sameContent } from '../export/deckJson';
import { slug } from './slug';
import {
  cardKey,
  type Card,
  type CardContent,
  type Deck,
  type ReviewState,
  type StudyMode,
} from './types';
import type { ValidDeck } from '../import/validation';
import { dayNumber, isoDate } from '../srs/day';
import { buildQueue } from '../srs/queue';
import { newState, schedule, type Rating } from '../srs/sm2';
import { accuracy, streak } from '../srs/stats';

export interface ImportPlan {
  deckExists: boolean;
  added: number;
  updated: number;
  /** Karten, die im Gerät liegen, aber in der Datei fehlen – werden samt Fortschritt entfernt. */
  removed: number;
  /** In der App angelegte oder geänderte Karten, die der Import ersetzt oder entfernt */
  editedLost: number;
}

export async function planImport(valid: ValidDeck): Promise<ImportPlan> {
  const deckId = valid.deck.id;
  const existing = await db.cards.where('deckId').equals(deckId).toArray();
  const deckExists = (await db.decks.get(deckId)) !== undefined;
  const incoming = new Map(valid.cards.map((c) => [cardKey(deckId, c.id), c]));
  const updated = existing.filter((c) => incoming.has(c.key)).length;
  // Eine App-Änderung geht nur verloren, wenn die Datei etwas anderes enthält – z. B. nicht,
  // wenn die Datei gerade aus der App exportiert wurde.
  const lost = (c: Card) => {
    if (c.editedAt === undefined) return false;
    const file = incoming.get(c.key);
    return !file || !sameContent(c, file);
  };
  return {
    deckExists,
    added: incoming.size - updated,
    updated,
    removed: existing.length - updated,
    editedLost: existing.filter(lost).length,
  };
}

/** Legt das Deck an oder aktualisiert es. Lernstände bestehender Karten-IDs bleiben erhalten. */
export async function applyImport(valid: ValidDeck, now = Date.now()): Promise<ImportPlan> {
  const deckId = valid.deck.id;
  return db.transaction('rw', db.decks, db.cards, db.states, async () => {
    const plan = await planImport(valid);
    const old = await db.decks.get(deckId);
    const deck: Deck = {
      ...valid.deck,
      title: old?.renamed ? old.title : valid.deck.title,
      importedAt: old?.importedAt ?? now,
      updatedAt: now,
    };
    if (old?.renamed) deck.renamed = true;
    await db.decks.put(deck);

    const cards: Card[] = valid.cards.map((content, order) => ({
      ...content,
      key: cardKey(deckId, content.id),
      deckId,
      order,
    }));
    const incoming = new Set(cards.map((c) => c.key));
    const existing = await db.cards.where('deckId').equals(deckId).primaryKeys();
    const stale = existing.filter((key) => !incoming.has(key));
    await db.cards.bulkDelete(stale);
    await db.states.bulkDelete(stale);
    await db.cards.bulkPut(cards);
    return plan;
  });
}

export async function renameDeck(deckId: string, title: string): Promise<void> {
  await db.decks.update(deckId, { title: title.trim(), renamed: true, updatedAt: Date.now() });
}

export async function deleteDeck(deckId: string): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, db.states, db.logs, async () => {
    await db.cards.where('deckId').equals(deckId).delete();
    await db.states.where('deckId').equals(deckId).delete();
    await db.logs.where('deckId').equals(deckId).delete();
    await db.decks.delete(deckId);
  });
}

export async function recordReview(
  card: Card,
  rating: Rating,
  now: Date = new Date(),
  mode: StudyMode = 'karteikarten',
): Promise<ReviewState> {
  const today = dayNumber(now);
  return db.transaction('rw', db.states, db.logs, async () => {
    const prev = await db.states.get(card.key);
    const next = schedule(prev ?? newState(today), rating, today);
    const state: ReviewState = {
      ...next,
      cardKey: card.key,
      deckId: card.deckId,
      lastReview: now.getTime(),
    };
    await db.states.put(state);
    await db.logs.add({
      cardKey: card.key,
      deckId: card.deckId,
      ts: now.getTime(),
      day: today,
      rating,
      wasNew: prev === undefined,
      intervalBefore: prev?.interval ?? 0,
      intervalAfter: next.interval,
      ease: next.ease,
      mode,
    });
    return state;
  });
}

export interface Limits {
  newPerDay: number;
  reviewsPerDay: number;
}

export interface Session {
  deck: Deck;
  cards: Map<string, Card>;
  states: Map<string, ReviewState>;
  queue: string[];
  waitingNew: number;
  waitingReview: number;
}

/** Stellt die heutige Lernsitzung zusammen. extraNew erlaubt neue Karten über das Tageslimit hinaus. */
export async function loadSession(
  deckId: string,
  limits: Limits,
  now: Date = new Date(),
  extraNew = 0,
): Promise<Session | undefined> {
  const deck = await db.decks.get(deckId);
  if (!deck) return undefined;
  const today = dayNumber(now);
  const [cardList, stateList, logsToday] = await Promise.all([
    db.cards.where('deckId').equals(deckId).sortBy('order'),
    db.states.where('deckId').equals(deckId).toArray(),
    db.logs.where('[deckId+day]').equals([deckId, today]).toArray(),
  ]);
  const cards = new Map(cardList.map((c) => [c.key, c]));
  // Lernstände ohne Karte kann es nach einem Re-Import nicht geben, aber die Queue soll nie ins Leere zeigen.
  const states = new Map(stateList.filter((s) => cards.has(s.cardKey)).map((s) => [s.cardKey, s]));

  const newDone = logsToday.filter((l) => l.wasNew).length;
  const reviewsDone = new Set(
    logsToday.filter((l) => !l.wasNew && l.intervalBefore > 0).map((l) => l.cardKey),
  ).size;

  const queue = buildQueue({
    order: cardList.map((c) => c.key),
    states,
    today,
    newSlots: Math.max(0, limits.newPerDay - newDone) + extraNew,
    reviewSlots: limits.reviewsPerDay - reviewsDone,
  });

  return {
    deck,
    cards,
    states,
    queue: [...queue.learning, ...queue.review, ...queue.fresh],
    waitingNew: queue.waitingNew,
    waitingReview: queue.waitingReview,
  };
}

export interface DeckSummary {
  deck: Deck;
  total: number;
  due: number;
  fresh: number;
}

export async function deckSummaries(now: Date = new Date()): Promise<DeckSummary[]> {
  const today = dayNumber(now);
  const decks = await db.decks.toArray();
  const summaries = await Promise.all(
    decks.map(async (deck) => {
      const [total, states] = await Promise.all([
        db.cards.where('deckId').equals(deck.id).count(),
        db.states.where('deckId').equals(deck.id).toArray(),
      ]);
      return {
        deck,
        total,
        due: states.filter((s) => s.due <= today).length,
        fresh: Math.max(0, total - states.length),
      };
    }),
  );
  return summaries.sort(
    (a, b) =>
      a.deck.subject.localeCompare(b.deck.subject, 'de') ||
      a.deck.title.localeCompare(b.deck.title, 'de'),
  );
}

export interface DeckStats {
  deck: Deck;
  total: number;
  due: number;
  fresh: number;
  /** Karten, die mindestens einmal bewertet wurden */
  learned: number;
  /** Karten mit einem Abstand von mindestens 21 Tagen */
  mature: number;
  reviewsToday: number;
  reviewsTotal: number;
  accuracyAll: number | null;
  accuracy7: number | null;
  streak: number;
  lastReview: number | null;
}

export async function deckStats(
  deckId: string,
  now: Date = new Date(),
): Promise<DeckStats | undefined> {
  const deck = await db.decks.get(deckId);
  if (!deck) return undefined;
  const today = dayNumber(now);
  const [total, states, logs] = await Promise.all([
    db.cards.where('deckId').equals(deckId).count(),
    db.states.where('deckId').equals(deckId).toArray(),
    db.logs.where('deckId').equals(deckId).toArray(),
  ]);
  const lastWeek = logs.filter((l) => l.day > today - 7);
  return {
    deck,
    total,
    due: states.filter((s) => s.due <= today).length,
    fresh: Math.max(0, total - states.length),
    learned: states.length,
    mature: states.filter((s) => s.interval >= 21).length,
    reviewsToday: logs.filter((l) => l.day === today).length,
    reviewsTotal: logs.length,
    accuracyAll: accuracy(logs.map((l) => l.rating)),
    accuracy7: accuracy(lastWeek.map((l) => l.rating)),
    streak: streak(
      logs.map((l) => l.day),
      today,
    ),
    lastReview: logs.reduce<number | null>(
      (max, l) => (max === null || l.ts > max ? l.ts : max),
      null,
    ),
  };
}

export type QuizScope =
  | { kind: 'deck'; deckId: string }
  | { kind: 'subject'; subject: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'all' };

export interface QuizCatalog {
  decks: Deck[];
  subjects: string[];
  tags: string[];
}

/** Was sich als Quiz-Bereich auswählen lässt. */
export async function quizCatalog(): Promise<QuizCatalog> {
  const [decks, cards] = await Promise.all([db.decks.toArray(), db.cards.toArray()]);
  const sorted = (values: Iterable<string>) =>
    [...new Set(values)].filter((v) => v !== '').sort((a, b) => a.localeCompare(b, 'de'));
  return {
    decks: decks.sort((a, b) => a.title.localeCompare(b.title, 'de')),
    subjects: sorted(decks.map((d) => d.subject)),
    tags: sorted(cards.flatMap((c) => c.tags)),
  };
}

export async function loadQuizCards(scope: QuizScope): Promise<Card[]> {
  switch (scope.kind) {
    case 'deck':
      return db.cards.where('deckId').equals(scope.deckId).toArray();
    case 'subject': {
      const deckIds = (await db.decks.toArray())
        .filter((d) => d.subject === scope.subject)
        .map((d) => d.id);
      return db.cards.where('deckId').anyOf(deckIds).toArray();
    }
    case 'tag':
      return db.cards.filter((c) => c.tags.includes(scope.tag)).toArray();
    case 'all':
      return db.cards.toArray();
  }
}

/**
 * Überträgt eine Quiz-Antwort in die Lernplanung. Falsch heißt "Nochmal". Richtig zählt als "Gut",
 * aber nur für neue oder heute fällige Karten – sonst würde ein Quiz zwischendurch die Abstände
 * aufblähen. Gibt zurück, ob die Planung geändert wurde.
 */
export async function recordQuizAnswer(
  card: Card,
  correct: boolean,
  now: Date = new Date(),
): Promise<boolean> {
  if (correct) {
    const state = await db.states.get(card.key);
    if (state && state.due > dayNumber(now)) return false;
  }
  await recordReview(card, correct ? 3 : 1, now, 'quiz');
  return true;
}

export interface CardList {
  cards: Card[];
  states: Map<string, ReviewState>;
  decks: Map<string, Deck>;
}

/** Karten eines Decks oder aller Decks samt Lernstand – für Suche und Bearbeiten. */
export async function listCards(deckId?: string): Promise<CardList> {
  const [cards, states, decks] = await Promise.all([
    deckId ? db.cards.where('deckId').equals(deckId).sortBy('order') : db.cards.toArray(),
    deckId ? db.states.where('deckId').equals(deckId).toArray() : db.states.toArray(),
    db.decks.toArray(),
  ]);
  return {
    cards,
    states: new Map(states.map((s) => [s.cardKey, s])),
    decks: new Map(decks.map((d) => [d.id, d])),
  };
}

function newCardId(): string {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Speichert eine in der App bearbeitete oder neue Karte. Der Lernstand bleibt erhalten. */
export async function saveCard(
  deckId: string,
  content: Omit<CardContent, 'id'>,
  existingKey?: string,
  now = Date.now(),
): Promise<Card> {
  return db.transaction('rw', db.cards, db.decks, async () => {
    const existing = existingKey ? await db.cards.get(existingKey) : undefined;
    let card: Card;
    if (existing) {
      card = {
        ...content,
        id: existing.id,
        key: existing.key,
        deckId,
        order: existing.order,
        editedAt: now,
      };
    } else {
      const id = newCardId();
      const last = await db.cards.where('deckId').equals(deckId).sortBy('order');
      const order = (last.at(-1)?.order ?? -1) + 1;
      card = { ...content, id, key: cardKey(deckId, id), deckId, order, editedAt: now };
    }
    await db.cards.put(card);
    await db.decks.update(deckId, { updatedAt: now });
    return card;
  });
}

/** Löscht eine Karte samt Lernstand. Das Protokoll bleibt für Statistik und Streak erhalten. */
export async function deleteCard(key: string): Promise<void> {
  await db.transaction('rw', db.cards, db.states, async () => {
    await db.cards.delete(key);
    await db.states.delete(key);
  });
}

/** Legt ein leeres Deck an, z. B. um Karten direkt in der App zu schreiben. */
export async function createDeck(
  title: string,
  subject: string,
  now: Date = new Date(),
): Promise<Deck> {
  const base = slug(title);
  let id = base;
  while (await db.decks.get(id)) id = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  const deck: Deck = {
    id,
    title: title.trim(),
    subject: subject.trim(),
    created: isoDate(now),
    importedAt: now.getTime(),
    updatedAt: now.getTime(),
  };
  await db.decks.add(deck);
  return deck;
}
