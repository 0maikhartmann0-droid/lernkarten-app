import { slug } from '../db/slug';
import type { Card, CardContent, Deck } from '../db/types';
import { SCHEMA_ID } from '../import/validation';

/** Eine Karte so, wie sie im Deck-JSON steht – nur die Felder ihres Typs. */
export function toJsonCard(card: CardContent): Record<string, unknown> {
  const json: Record<string, unknown> = { id: card.id, type: card.type, front: card.front };
  if (card.type === 'basic' || card.type === 'typed') json.back = card.back ?? '';
  if (card.type === 'mc') {
    json.choices = card.choices ?? [];
    json.answer = card.answer;
  }
  if (card.type === 'tf') json.answer = card.answer === true;
  if (card.explain) json.explain = card.explain;
  if (card.tags.length > 0) json.tags = card.tags;
  if (card.source) json.source = card.source;
  if (card.image) json.image = card.image;
  return json;
}

/** Gleicher Inhalt im Sinne des Deck-Formats (Reihenfolge der Felder egal). */
export function sameContent(a: CardContent, b: CardContent): boolean {
  return JSON.stringify(toJsonCard(a)) === JSON.stringify(toJsonCard(b));
}

/** Deck als Datei im Format "lernkarten-deck/v1" – lässt sich unverändert wieder importieren. */
export function toDeckFile(deck: Deck, cards: readonly Card[]) {
  const meta: Record<string, string> = {
    id: deck.id,
    title: deck.title,
    subject: deck.subject,
    created: deck.created,
  };
  if (deck.source) meta.source = deck.source;
  return {
    schema: SCHEMA_ID,
    deck: meta,
    cards: [...cards].sort((a, b) => a.order - b.order).map(toJsonCard),
  };
}

export function exportFileName(deck: Deck, extension: string): string {
  return `${slug(deck.title)}.${extension}`;
}
