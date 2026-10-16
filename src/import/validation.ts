import { CARD_TYPES, type CardContent, type CardType } from '../db/types';
import { hasCloze } from '../modes/cloze';
import { isoDate } from '../srs/day';

export const SCHEMA_ID = 'lernkarten-deck/v1';

export interface DeckMeta {
  id: string;
  title: string;
  subject: string;
  created: string;
  source?: string;
}

export interface ValidDeck {
  deck: DeckMeta;
  cards: CardContent[];
  warnings: string[];
}

export type ValidationResult = { ok: true; value: ValidDeck } | { ok: false; errors: string[] };

type Json = Record<string, unknown>;

const TYPE_LIST = CARD_TYPES.join(', ');

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Liest den Text einer Deck-Datei und prüft ihn gegen das Schema. */
export function parseDeckJson(text: string, today: Date = new Date()): ValidationResult {
  const cleaned = stripWrapper(text);
  if (cleaned === '') return { ok: false, errors: ['Die Datei ist leer.'] };
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch (error) {
    return { ok: false, errors: [describeSyntaxError(cleaned, error)] };
  }
  return validateDeck(data, today);
}

// Aus dem Chat kopiertes JSON bringt oft ein BOM oder einen ```json-Zaun mit.
function stripWrapper(text: string): string {
  const trimmed = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trim();
  const fenced = /^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return fenced?.[1] !== undefined ? fenced[1].trim() : trimmed;
}

function describeSyntaxError(text: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const hint =
    'Häufige Ursachen: fehlendes Komma, fehlende Anführungszeichen oder ein Komma nach dem letzten Eintrag.';
  const position = /position (\d+)/.exec(message);
  if (!position) return `Kein gültiges JSON. ${hint} (Technische Meldung: ${message})`;
  const before = text.slice(0, Number(position[1]));
  const line = before.split('\n').length;
  const column = before.length - before.lastIndexOf('\n');
  return `Kein gültiges JSON: Fehler in Zeile ${line}, Spalte ${column}. ${hint} (Technische Meldung: ${message})`;
}

export function validateDeck(data: unknown, today: Date = new Date()): ValidationResult {
  if (!isObject(data)) {
    return {
      ok: false,
      errors: [
        'Die Datei muss ein JSON-Objekt mit den Feldern "schema", "deck" und "cards" enthalten.',
      ],
    };
  }
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.schema === undefined) {
    errors.push(`Feld "schema" fehlt. Erwartet: "${SCHEMA_ID}".`);
  } else if (data.schema !== SCHEMA_ID) {
    errors.push(`Unbekanntes Schema ${JSON.stringify(data.schema)}. Erwartet: "${SCHEMA_ID}".`);
  }

  const deck = readDeck(data.deck, errors, today);
  const cards = readCards(data.cards, errors, warnings);

  if (errors.length > 0 || !deck) return { ok: false, errors };
  return { ok: true, value: { deck, cards, warnings } };
}

function readDeck(raw: unknown, errors: string[], today: Date): DeckMeta | undefined {
  if (!isObject(raw)) {
    errors.push('Abschnitt "deck" fehlt (erwartet: { "id": …, "title": … }).');
    return undefined;
  }
  const before = errors.length;
  if (!isText(raw.id))
    errors.push('Deck: Feld "id" fehlt oder ist leer (z. B. "bauphysik-schallschutz").');
  if (!isText(raw.title)) errors.push('Deck: Feld "title" fehlt oder ist leer.');
  const subject = optionalText(raw, 'subject', 'Deck', errors);
  const created = optionalText(raw, 'created', 'Deck', errors);
  const source = optionalText(raw, 'source', 'Deck', errors);
  if (errors.length > before || !isText(raw.id) || !isText(raw.title)) return undefined;

  const deck: DeckMeta = {
    id: raw.id.trim(),
    title: raw.title.trim(),
    subject: subject ?? '',
    created: created ?? isoDate(today),
  };
  if (source) deck.source = source;
  return deck;
}

function readCards(raw: unknown, errors: string[], warnings: string[]): CardContent[] {
  if (!Array.isArray(raw)) {
    errors.push('Feld "cards" fehlt oder ist keine Liste ([ … ]).');
    return [];
  }
  if (raw.length === 0) {
    errors.push('Das Deck enthält keine Karten ("cards" ist leer).');
    return [];
  }

  const cards: CardContent[] = [];
  const firstUse = new Map<string, number>();
  let withoutId = 0;

  raw.forEach((item, index) => {
    const nr = `Karte ${index + 1}`;
    if (!isObject(item)) {
      errors.push(`${nr}: Muss ein Objekt sein ({ … }).`);
      return;
    }
    const givenId = readId(item.id);
    if (givenId === null) {
      errors.push(`${nr}: Feld "id" muss ein Text sein (z. B. "c001").`);
      return;
    }
    const label = givenId ? `${nr} (id "${givenId}")` : nr;
    const card = readCard(item, label, errors);
    if (!card) return;

    if (givenId === undefined) withoutId++;
    const id = givenId ?? autoId(card);
    const seen = firstUse.get(id);
    if (seen !== undefined) {
      errors.push(
        givenId
          ? `${label}: Die id ist doppelt vergeben (bereits bei Karte ${seen}). IDs müssen im Deck eindeutig sein.`
          : `${label}: Gleiche Frage wie Karte ${seen} und keine "id" – bitte eine der beiden Karten entfernen oder IDs vergeben.`,
      );
      return;
    }
    firstUse.set(id, index + 1);
    cards.push({ ...card, id });
  });

  if (withoutId > 0) {
    warnings.push(
      `${withoutId} Karte(n) ohne "id": Die App leitet die ID aus Typ und Frage ab. Wird die Frage später geändert, beginnt der Lernfortschritt dieser Karte neu.`,
    );
  }
  return cards;
}

/** undefined = keine id angegeben, null = id unbrauchbar */
function readId(raw: unknown): string | undefined | null {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (isText(raw)) return raw.trim();
  return null;
}

export type CardCheck =
  { ok: true; card: Omit<CardContent, 'id'> } | { ok: false; errors: string[] };

/** Prüft eine einzelne Karte nach denselben Regeln wie der Import, z. B. aus dem Editor. */
export function checkCard(raw: unknown): CardCheck {
  if (!isObject(raw)) return { ok: false, errors: ['Die Karte ist leer.'] };
  const errors: string[] = [];
  const card = readCard(raw, 'Karte', errors);
  if (!card || errors.length > 0) {
    return { ok: false, errors: errors.map((e) => e.replace(/^Karte: /, '')) };
  }
  return { ok: true, card };
}

function readCard(raw: Json, label: string, errors: string[]): Omit<CardContent, 'id'> | undefined {
  const before = errors.length;

  const type = CARD_TYPES.find((t) => t === raw.type);
  if (raw.type === undefined) {
    errors.push(`${label}: Feld "type" fehlt. Erlaubt: ${TYPE_LIST}.`);
  } else if (!type) {
    errors.push(`${label}: Unbekannter Typ ${JSON.stringify(raw.type)}. Erlaubt: ${TYPE_LIST}.`);
  }
  if (!isText(raw.front)) {
    errors.push(`${label}: Feld "front" (Frage/Vorderseite) fehlt oder ist leer.`);
  }

  const back = optionalText(raw, 'back', label, errors);
  const explain = optionalText(raw, 'explain', label, errors);
  const source = optionalText(raw, 'source', label, errors);
  const image = optionalText(raw, 'image', label, errors);
  const tags = readTags(raw.tags, label, errors);

  const card: Omit<CardContent, 'id'> = {
    type: type ?? 'basic',
    front: isText(raw.front) ? raw.front : '',
    tags,
  };
  if (type) checkType(type, raw, card, back, label, errors);

  if (errors.length > before) return undefined;
  if (back && (type === 'basic' || type === 'typed')) card.back = back;
  if (explain) card.explain = explain;
  if (source) card.source = source;
  if (image) card.image = image;
  return card;
}

function checkType(
  type: CardType,
  raw: Json,
  card: Omit<CardContent, 'id'>,
  back: string | undefined,
  label: string,
  errors: string[],
): void {
  switch (type) {
    case 'basic':
    case 'typed':
      if (!back) {
        errors.push(
          `${label}: Feld "back" (Antwort) fehlt oder ist leer – Pflicht bei Typ "${type}".`,
        );
      }
      return;
    case 'mc': {
      const choices = raw.choices;
      if (!Array.isArray(choices)) {
        errors.push(`${label}: Feld "choices" fehlt oder ist keine Liste – Pflicht bei Typ "mc".`);
        return;
      }
      if (choices.length < 2) {
        errors.push(`${label}: "choices" braucht mindestens 2 Antwortmöglichkeiten.`);
      }
      const bad = choices.findIndex((c) => !isText(c));
      if (bad !== -1) {
        errors.push(
          `${label}: Antwortmöglichkeit ${bad + 1} in "choices" ist kein Text oder leer.`,
        );
      }
      const answer = raw.answer;
      if (
        typeof answer !== 'number' ||
        !Number.isInteger(answer) ||
        answer < 0 ||
        answer >= choices.length
      ) {
        errors.push(
          `${label}: Feld "answer" muss der Index der richtigen Antwort sein (0 = erste Antwort, höchstens ${Math.max(0, choices.length - 1)}). Gefunden: ${JSON.stringify(answer)}.`,
        );
        return;
      }
      if (bad === -1) {
        card.choices = (choices as string[]).map((c) => c.trim());
        card.answer = answer;
      }
      return;
    }
    case 'tf':
      if (typeof raw.answer !== 'boolean') {
        errors.push(
          `${label}: Feld "answer" muss true oder false sein (ohne Anführungszeichen) – Pflicht bei Typ "tf".`,
        );
        return;
      }
      card.answer = raw.answer;
      return;
    case 'cloze':
      if (isText(raw.front) && !hasCloze(raw.front)) {
        errors.push(
          `${label}: Lückentext ohne Lücke – "front" braucht mindestens eine Markierung wie {{c1::Antwort}}.`,
        );
      }
      return;
  }
}

function optionalText(
  raw: Json,
  field: string,
  label: string,
  errors: string[],
): string | undefined {
  const value = raw[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    errors.push(`${label}: Feld "${field}" muss ein Text sein.`);
    return undefined;
  }
  return value.trim() === '' ? undefined : value;
}

function readTags(raw: unknown, label: string, errors: string[]): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.some((t) => typeof t !== 'string')) {
    errors.push(`${label}: Feld "tags" muss eine Liste von Texten sein (z. B. ["schallschutz"]).`);
    return [];
  }
  return [...new Set((raw as string[]).map((t) => t.trim()).filter((t) => t !== ''))];
}

// Stabile Ersatz-ID (FNV-1a), damit ein Re-Import ohne IDs den Fortschritt trotzdem wiederfindet.
function autoId(card: Omit<CardContent, 'id'>): string {
  return stableId(`${card.type}|${card.front.trim()}`);
}

/** Gleicher Text ergibt immer dieselbe ID – auch beim Import aus Anki oder Quizlet. */
export function stableId(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `auto-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
