import type { Rating, SrsState } from '../srs/sm2';

export type CardType = 'basic' | 'mc' | 'tf' | 'cloze' | 'typed';

export const CARD_TYPES: readonly CardType[] = ['basic', 'mc', 'tf', 'cloze', 'typed'];

export type StudyMode = 'karteikarten' | 'quiz';

export interface Deck {
  id: string;
  title: string;
  subject: string;
  created: string;
  source?: string;
  importedAt: number;
  updatedAt: number;
  /** In der App umbenannt – ein Re-Import überschreibt den Titel dann nicht. */
  renamed?: boolean;
}

/** Karteninhalt, wie er im Deck-JSON steht. */
export interface CardContent {
  id: string;
  type: CardType;
  front: string;
  back?: string;
  choices?: string[];
  answer?: number | boolean;
  explain?: string;
  tags: string[];
  source?: string;
  image?: string;
}

export interface Card extends CardContent {
  /** Primärschlüssel: deckId + "::" + id */
  key: string;
  deckId: string;
  order: number;
  /** In der App angelegt oder geändert – ein Re-Import würde das überschreiben. */
  editedAt?: number;
}

export interface ReviewState extends SrsState {
  cardKey: string;
  deckId: string;
  lastReview: number;
}

export interface ReviewLog {
  id?: number;
  cardKey: string;
  deckId: string;
  ts: number;
  day: number;
  rating: Rating;
  wasNew: boolean;
  intervalBefore: number;
  intervalAfter: number;
  ease: number;
  mode: StudyMode;
}

export function cardKey(deckId: string, cardId: string): string {
  return `${deckId}::${cardId}`;
}
