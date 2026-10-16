import { db } from './db';
import { CARD_TYPES, type Card, type Deck, type ReviewLog, type ReviewState } from './types';
import { isoDate } from '../srs/day';

export const BACKUP_SCHEMA = 'lernkarten-backup/v1';

export interface Backup {
  schema: typeof BACKUP_SCHEMA;
  exported: string;
  decks: Deck[];
  cards: Card[];
  states: ReviewState[];
  logs: ReviewLog[];
  /** Einstellungen der App (localStorage), beim Wiederherstellen optional */
  settings?: unknown;
}

export type BackupCheck =
  { ok: true; backup: Backup; warnings: string[] } | { ok: false; errors: string[] };

export async function createBackup(settings: unknown, now: Date = new Date()): Promise<Backup> {
  const [decks, cards, states, logs] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.states.toArray(),
    db.logs.toArray(),
  ]);
  return {
    schema: BACKUP_SCHEMA,
    exported: now.toISOString(),
    decks,
    cards,
    states,
    logs,
    settings,
  };
}

export function backupFileName(now: Date = new Date()): string {
  return `lernkarten-backup-${isoDate(now)}.json`;
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const MAX_ERRORS = 10;

/** Prüft eine Backup-Datei, bevor sie die Daten auf dem Gerät ersetzt. */
export function parseBackup(text: string): BackupCheck {
  let data: unknown;
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    return { ok: false, errors: ['Die Datei ist kein gültiges JSON.'] };
  }
  if (!isObject(data))
    return { ok: false, errors: ['Die Datei ist kein Backup der Lernkarten-App.'] };
  if (data.schema === 'lernkarten-deck/v1') {
    return {
      ok: false,
      errors: ['Das ist eine Deck-Datei, kein Backup. Decks importierst du in der Deckliste.'],
    };
  }
  if (data.schema !== BACKUP_SCHEMA) {
    return {
      ok: false,
      errors: [`Unbekanntes Format – erwartet wird "schema": "${BACKUP_SCHEMA}".`],
    };
  }

  const errors: string[] = [];
  const list = (field: string): unknown[] => {
    const value = data[field];
    if (Array.isArray(value)) return value;
    errors.push(`Feld "${field}" fehlt oder ist keine Liste.`);
    return [];
  };
  const decks = list('decks');
  const cards = list('cards');
  const states = list('states');
  const logs = list('logs');
  if (errors.length > 0) return { ok: false, errors };

  const check = (items: unknown[], label: string, valid: (v: Json) => boolean) =>
    items.forEach((item, i) => {
      if (!isObject(item) || !valid(item))
        errors.push(`${label} ${i + 1} ist unvollständig oder beschädigt.`);
    });
  check(decks, 'Deck', (d) => isString(d.id) && typeof d.title === 'string');
  check(
    cards,
    'Karte',
    (c) =>
      isString(c.key) &&
      isString(c.deckId) &&
      isString(c.id) &&
      CARD_TYPES.includes(c.type as Card['type']) &&
      typeof c.front === 'string' &&
      Array.isArray(c.tags),
  );
  check(
    states,
    'Lernstand',
    (s) =>
      isString(s.cardKey) &&
      isString(s.deckId) &&
      [s.ease, s.interval, s.due, s.reps, s.lapses].every(isNumber),
  );
  check(
    logs,
    'Protokolleintrag',
    (l) =>
      isString(l.cardKey) &&
      isString(l.deckId) &&
      isNumber(l.day) &&
      [1, 2, 3, 4].includes(l.rating as number),
  );
  if (errors.length > 0) {
    const shown = errors.slice(0, MAX_ERRORS);
    if (errors.length > MAX_ERRORS)
      shown.push(`… und ${errors.length - MAX_ERRORS} weitere Fehler.`);
    return { ok: false, errors: shown };
  }

  // Verwaiste Einträge (z. B. nach einem abgebrochenen Löschen) werden still aussortiert.
  const deckIds = new Set((decks as Deck[]).map((d) => d.id));
  const keptCards = (cards as Card[]).filter((c) => deckIds.has(c.deckId));
  const cardKeys = new Set(keptCards.map((c) => c.key));
  const keptStates = (states as ReviewState[]).filter((s) => cardKeys.has(s.cardKey));
  const keptLogs = (logs as ReviewLog[]).filter((l) => deckIds.has(l.deckId));
  const dropped =
    cards.length -
    keptCards.length +
    (states.length - keptStates.length) +
    (logs.length - keptLogs.length);

  const backup: Backup = {
    schema: BACKUP_SCHEMA,
    exported: typeof data.exported === 'string' ? data.exported : '',
    decks: decks as Deck[],
    cards: keptCards,
    states: keptStates,
    logs: keptLogs,
  };
  if (data.settings !== undefined) backup.settings = data.settings;
  return {
    ok: true,
    backup,
    warnings:
      dropped > 0
        ? [`${dropped} verwaiste Einträge ohne zugehöriges Deck werden übersprungen.`]
        : [],
  };
}

/** Ersetzt alle Decks, Karten, Lernstände und das Protokoll auf diesem Gerät. */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, db.states, db.logs, async () => {
    await Promise.all([db.decks.clear(), db.cards.clear(), db.states.clear(), db.logs.clear()]);
    await db.decks.bulkPut(backup.decks);
    await db.cards.bulkPut(backup.cards);
    await db.states.bulkPut(backup.states);
    await db.logs.bulkPut(backup.logs);
  });
}
