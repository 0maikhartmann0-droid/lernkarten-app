import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { validateDeck, type ValidDeck } from '../import/validation';
import { db } from './db';
import {
  applyImport,
  createDeck,
  deckStats,
  deckSummaries,
  deleteCard,
  deleteDeck,
  listCards,
  loadQuizCards,
  loadSession,
  planImport,
  quizCatalog,
  recordQuizAnswer,
  recordReview,
  renameDeck,
  saveCard,
} from './repo';

const NOW = new Date(2026, 9, 13, 8, 0);
const TOMORROW = new Date(2026, 9, 14, 8, 0);
const LIMITS = { newPerDay: 20, reviewsPerDay: 100 };

function deckFile(
  cards: { id: string; front?: string; back?: string }[],
  title = 'Testdeck',
): ValidDeck {
  const result = validateDeck({
    schema: 'lernkarten-deck/v1',
    deck: { id: 'test', title, subject: 'Bauphysik' },
    cards: cards.map((c) => ({
      type: 'basic',
      front: c.front ?? `Frage ${c.id}`,
      back: c.back ?? 'A',
      id: c.id,
    })),
  });
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value;
}

async function card(id: string) {
  const found = await db.cards.get(`test::${id}`);
  if (!found) throw new Error(`Karte ${id} fehlt`);
  return found;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Import', () => {
  it('legt Deck und Karten in Dateireihenfolge an', async () => {
    const plan = await applyImport(deckFile([{ id: 'a' }, { id: 'b' }]));
    expect(plan).toEqual({ deckExists: false, added: 2, updated: 0, removed: 0, editedLost: 0 });
    const [summary] = await deckSummaries(NOW);
    expect(summary).toMatchObject({ total: 2, due: 0, fresh: 2 });
    expect((await card('b')).order).toBe(1);
  });

  it('aktualisiert beim Re-Import die Inhalte und behält den Lernfortschritt', async () => {
    await applyImport(deckFile([{ id: 'a' }, { id: 'b' }]));
    const before = await recordReview(await card('a'), 3, NOW);

    const plan = await applyImport(
      deckFile([{ id: 'a', back: 'Korrigiert' }, { id: 'b' }, { id: 'c' }]),
    );

    expect(plan).toEqual({ deckExists: true, added: 1, updated: 2, removed: 0, editedLost: 0 });
    expect((await card('a')).back).toBe('Korrigiert');
    expect(await db.states.get('test::a')).toEqual(before);
    expect(await db.cards.where('deckId').equals('test').count()).toBe(3);
  });

  it('entfernt Karten, die in der neuen Datei fehlen, samt Lernstand', async () => {
    await applyImport(deckFile([{ id: 'a' }, { id: 'b' }]));
    await recordReview(await card('b'), 3, NOW);

    const next = deckFile([{ id: 'a' }]);
    expect((await planImport(next)).removed).toBe(1);
    await applyImport(next);

    expect(await db.cards.get('test::b')).toBeUndefined();
    expect(await db.states.get('test::b')).toBeUndefined();
  });

  it('behält einen in der App geänderten Titel beim Re-Import', async () => {
    await applyImport(deckFile([{ id: 'a' }]));
    await renameDeck('test', 'Mein Titel');
    await applyImport(deckFile([{ id: 'a' }], 'Titel aus Datei'));
    expect((await db.decks.get('test'))?.title).toBe('Mein Titel');
  });

  it('löscht ein Deck vollständig', async () => {
    await applyImport(deckFile([{ id: 'a' }]));
    await recordReview(await card('a'), 3, NOW);
    await deleteDeck('test');
    expect(await db.decks.count()).toBe(0);
    expect(await db.cards.count()).toBe(0);
    expect(await db.states.count()).toBe(0);
    expect(await db.logs.count()).toBe(0);
  });
});

describe('Lernsitzung', () => {
  beforeEach(async () => {
    await applyImport(deckFile([{ id: 'a' }, { id: 'b' }, { id: 'c' }]));
  });

  it('bietet neue Karten bis zum Tageslimit an', async () => {
    const session = await loadSession('test', { newPerDay: 2, reviewsPerDay: 100 }, NOW);
    expect(session?.queue).toEqual(['test::a', 'test::b']);
    expect(session?.waitingNew).toBe(1);
  });

  it('rechnet heute schon gelernte neue Karten auf das Limit an', async () => {
    await recordReview(await card('a'), 3, NOW);
    const session = await loadSession('test', { newPerDay: 2, reviewsPerDay: 100 }, NOW);
    expect(session?.queue).toEqual(['test::b']);
    const extra = await loadSession('test', { newPerDay: 1, reviewsPerDay: 100 }, NOW, 10);
    expect(extra?.queue).toEqual(['test::b', 'test::c']);
  });

  it('zeigt eine mit "Nochmal" bewertete Karte in derselben Sitzung wieder', async () => {
    await recordReview(await card('a'), 1, NOW);
    const session = await loadSession('test', { newPerDay: 0, reviewsPerDay: 0 }, NOW);
    expect(session?.queue).toEqual(['test::a']);
  });

  it('legt gelernte Karten am Fälligkeitstag wieder vor', async () => {
    await recordReview(await card('a'), 3, NOW);
    expect((await loadSession('test', { newPerDay: 0, reviewsPerDay: 100 }, NOW))?.queue).toEqual(
      [],
    );
    expect(
      (await loadSession('test', { newPerDay: 0, reviewsPerDay: 100 }, TOMORROW))?.queue,
    ).toEqual(['test::a']);
  });

  it('gibt für ein unbekanntes Deck nichts zurück', async () => {
    expect(await loadSession('gibt-es-nicht', LIMITS, NOW)).toBeUndefined();
  });

  it('führt Statistik über Bewertungen, Trefferquote und Streak', async () => {
    await recordReview(await card('a'), 3, NOW);
    await recordReview(await card('b'), 1, NOW);
    await recordReview(await card('b'), 3, TOMORROW);

    const stats = await deckStats('test', TOMORROW);
    expect(stats).toMatchObject({
      total: 3,
      fresh: 1,
      learned: 2,
      due: 1,
      reviewsTotal: 3,
      reviewsToday: 1,
      streak: 2,
    });
    expect(stats?.accuracyAll).toBeCloseTo(2 / 3);
  });
});

describe('Quiz', () => {
  beforeEach(async () => {
    await applyImport(deckFile([{ id: 'a' }, { id: 'b' }]));
  });

  it('wertet eine falsche Antwort als "Nochmal"', async () => {
    expect(await recordQuizAnswer(await card('a'), false, NOW)).toBe(true);
    expect(await db.states.get('test::a')).toMatchObject({ interval: 0, reps: 0 });
    expect((await db.logs.toArray())[0]).toMatchObject({ rating: 1, mode: 'quiz' });
  });

  it('plant eine neue Karte nach richtiger Antwort wie "Gut" ein', async () => {
    expect(await recordQuizAnswer(await card('a'), true, NOW)).toBe(true);
    expect(await db.states.get('test::a')).toMatchObject({ interval: 1, reps: 1 });
  });

  it('lässt nicht fällige Karten bei richtiger Antwort unverändert', async () => {
    const before = await recordReview(await card('a'), 4, NOW);
    expect(await recordQuizAnswer(await card('a'), true, NOW)).toBe(false);
    expect(await db.states.get('test::a')).toEqual(before);
    expect(await db.logs.count()).toBe(1);
  });

  it('wählt Karten nach Deck, Fach oder Tag aus', async () => {
    const tagged = validateDeck({
      schema: 'lernkarten-deck/v1',
      deck: { id: 'statik', title: 'Statik', subject: 'Statik' },
      cards: [{ id: 's1', type: 'basic', front: 'F', back: 'A', tags: ['lasten'] }],
    });
    if (!tagged.ok) throw new Error(tagged.errors.join('\n'));
    await applyImport(tagged.value);

    expect(await loadQuizCards({ kind: 'deck', deckId: 'test' })).toHaveLength(2);
    expect(await loadQuizCards({ kind: 'subject', subject: 'Statik' })).toHaveLength(1);
    expect((await loadQuizCards({ kind: 'tag', tag: 'lasten' }))[0]?.key).toBe('statik::s1');
    expect(await loadQuizCards({ kind: 'all' })).toHaveLength(3);
    expect(await quizCatalog()).toMatchObject({
      subjects: ['Bauphysik', 'Statik'],
      tags: ['lasten'],
    });
  });
});

describe('Karten in der App bearbeiten', () => {
  beforeEach(async () => {
    await applyImport(deckFile([{ id: 'a' }, { id: 'b' }]));
  });

  it('ändert eine Karte und behält ihren Lernstand', async () => {
    const state = await recordReview(await card('a'), 3, NOW);
    await saveCard('test', { type: 'basic', front: 'Neu?', back: 'Ja', tags: ['x'] }, 'test::a', 5);
    expect(await card('a')).toMatchObject({ front: 'Neu?', back: 'Ja', order: 0, editedAt: 5 });
    expect(await db.states.get('test::a')).toEqual(state);
  });

  it('entfernt beim Speichern Felder, die es nicht mehr gibt', async () => {
    await saveCard('test', { type: 'tf', front: 'Aussage', answer: true, tags: [] }, 'test::a');
    expect((await card('a')).back).toBeUndefined();
  });

  it('hängt neue Karten ans Ende des Decks', async () => {
    const created = await saveCard('test', { type: 'basic', front: 'F', back: 'A', tags: [] });
    expect(created.id).toMatch(/^app-/);
    expect(created.order).toBe(2);
    expect((await listCards('test')).cards.map((c) => c.key).at(-1)).toBe(created.key);
  });

  it('löscht eine Karte samt Lernstand', async () => {
    await recordReview(await card('a'), 3, NOW);
    await deleteCard('test::a');
    expect(await db.cards.get('test::a')).toBeUndefined();
    expect(await db.states.get('test::a')).toBeUndefined();
    expect(await db.logs.count()).toBe(1);
  });

  it('warnt beim Re-Import vor überschriebenen App-Änderungen', async () => {
    await saveCard('test', { type: 'basic', front: 'Geändert', back: 'A', tags: [] }, 'test::a');
    await saveCard('test', { type: 'basic', front: 'Eigene', back: 'A', tags: [] });
    const plan = await planImport(deckFile([{ id: 'a' }, { id: 'b' }]));
    expect(plan).toMatchObject({ updated: 2, removed: 1, editedLost: 2 });
    await applyImport(deckFile([{ id: 'a' }, { id: 'b' }]));
    expect((await card('a')).editedAt).toBeUndefined();
  });

  it('legt ein leeres Deck mit lesbarer, eindeutiger ID an', async () => {
    const first = await createDeck('Holzbau – Verbindungen', 'Holzbau', NOW);
    const second = await createDeck('Holzbau – Verbindungen', 'Holzbau', NOW);
    expect(first.id).toBe('holzbau-verbindungen');
    expect(second.id).toMatch(/^holzbau-verbindungen-[a-z0-9]+$/);
    expect(first).toMatchObject({
      title: 'Holzbau – Verbindungen',
      subject: 'Holzbau',
      created: '2026-10-13',
    });
  });
});

describe('Re-Import des eigenen Exports', () => {
  it('warnt nicht, wenn die Datei die App-Änderung schon enthält', async () => {
    await applyImport(deckFile([{ id: 'a' }, { id: 'b' }]));
    await saveCard('test', { type: 'basic', front: 'Frage a', back: 'Neu', tags: [] }, 'test::a');
    const same = deckFile([{ id: 'a', front: 'Frage a', back: 'Neu' }, { id: 'b' }]);
    expect((await planImport(same)).editedLost).toBe(0);
    const other = deckFile([{ id: 'a', front: 'Frage a', back: 'Alt' }, { id: 'b' }]);
    expect((await planImport(other)).editedLost).toBe(1);
  });
});
