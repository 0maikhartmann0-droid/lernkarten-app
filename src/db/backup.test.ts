import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { validateDeck } from '../import/validation';
import { BACKUP_SCHEMA, backupFileName, createBackup, parseBackup, restoreBackup } from './backup';
import { db } from './db';
import { applyImport, recordReview } from './repo';

const NOW = new Date(2026, 9, 13, 8, 0);

async function seed() {
  const result = validateDeck({
    schema: 'lernkarten-deck/v1',
    deck: { id: 'test', title: 'Testdeck', subject: 'Bauphysik' },
    cards: [
      { id: 'a', type: 'basic', front: 'F', back: 'A' },
      { id: 'b', type: 'tf', front: 'S', answer: true },
    ],
  });
  if (!result.ok) throw new Error(result.errors.join('\n'));
  await applyImport(result.value);
  const card = await db.cards.get('test::a');
  await recordReview(card!, 3, NOW);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Backup', () => {
  it('stellt Decks, Karten, Lernstände und Protokoll vollständig wieder her', async () => {
    await seed();
    const backup = await createBackup({ theme: 'dark' }, NOW);
    const text = JSON.stringify(backup);

    await db.decks.clear();
    await db.cards.clear();
    await db.states.clear();
    await db.logs.clear();

    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
    await restoreBackup(parsed.backup);

    expect(await db.decks.count()).toBe(1);
    expect(await db.cards.count()).toBe(2);
    expect(await db.states.get('test::a')).toEqual(backup.states[0]);
    expect(await db.logs.count()).toBe(1);
    expect(parsed.backup.settings).toEqual({ theme: 'dark' });
  });

  it('ersetzt beim Wiederherstellen die vorhandenen Daten', async () => {
    const empty = await createBackup(undefined, NOW);
    await seed();
    await restoreBackup(empty);
    expect(await db.decks.count()).toBe(0);
    expect(await db.cards.count()).toBe(0);
  });

  it('benennt die Datei mit Datum', () => {
    expect(backupFileName(NOW)).toBe('lernkarten-backup-2026-10-13.json');
  });
});

describe('parseBackup', () => {
  const valid = { schema: BACKUP_SCHEMA, exported: '', decks: [], cards: [], states: [], logs: [] };

  it('erkennt eine Deck-Datei und erklärt den richtigen Weg', () => {
    const result = parseBackup(JSON.stringify({ schema: 'lernkarten-deck/v1' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('Deck-Datei, kein Backup');
  });

  it('lehnt kaputtes JSON und fehlende Listen ab', () => {
    expect(parseBackup('{').ok).toBe(false);
    const result = parseBackup(JSON.stringify({ ...valid, logs: undefined }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual(['Feld "logs" fehlt oder ist keine Liste.']);
  });

  it('meldet beschädigte Einträge mit Nummer', () => {
    const result = parseBackup(
      JSON.stringify({ ...valid, decks: [{ id: 'x', title: 'X' }, { title: 'ohne id' }] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual(['Deck 2 ist unvollständig oder beschädigt.']);
  });

  it('überspringt verwaiste Karten und Lernstände mit Hinweis', () => {
    const result = parseBackup(
      JSON.stringify({
        ...valid,
        cards: [{ key: 'weg::a', deckId: 'weg', id: 'a', type: 'basic', front: 'F', tags: [] }],
        states: [
          { cardKey: 'weg::a', deckId: 'weg', ease: 2.5, interval: 1, due: 1, reps: 1, lapses: 0 },
        ],
      }),
    );
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.backup.cards).toEqual([]);
    expect(result.backup.states).toEqual([]);
    expect(result.warnings[0]).toContain('2 verwaiste Einträge');
  });
});
