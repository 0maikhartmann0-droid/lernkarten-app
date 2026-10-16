import Dexie, { type Table } from 'dexie';
import type { Card, Deck, ReviewLog, ReviewState } from './types';

export class LernkartenDB extends Dexie {
  decks!: Table<Deck, string>;
  cards!: Table<Card, string>;
  states!: Table<ReviewState, string>;
  logs!: Table<ReviewLog, number>;

  constructor(name = 'lernkarten') {
    super(name);
    this.version(1).stores({
      decks: 'id',
      cards: 'key, deckId',
      states: 'cardKey, deckId',
      logs: '++id, deckId, [deckId+day]',
    });
  }
}

export const db = new LernkartenDB();
