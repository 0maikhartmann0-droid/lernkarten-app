import type { CardContent } from '../db/types';
import { clozeBack, clozeFront } from './cloze';

export interface CardFaces {
  /** Markdown für die Vorderseite */
  front: string;
  /** Markdown für die Rückseite */
  back: string;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function choiceLabel(index: number): string {
  return LETTERS[index] ?? String(index + 1);
}

/** Jeder Kartentyp lässt sich als Karteikarte lernen; die Quiz-Modi kommen in Phase 2 dazu. */
export function cardFaces(card: CardContent): CardFaces {
  switch (card.type) {
    case 'mc': {
      const choices = card.choices ?? [];
      const list = choices.map((c, i) => `- **${choiceLabel(i)})** ${c}`).join('\n');
      const index = typeof card.answer === 'number' ? card.answer : -1;
      const correct = choices[index];
      return {
        front: `${card.front}\n\n${list}`,
        back: correct === undefined ? '' : `**${choiceLabel(index)})** ${correct}`,
      };
    }
    case 'tf':
      return {
        front: `${card.front}\n\n*Richtig oder falsch?*`,
        back: card.answer === true ? '**Richtig**' : '**Falsch**',
      };
    case 'cloze':
      return { front: clozeFront(card.front), back: clozeBack(card.front) };
    case 'basic':
    case 'typed':
      return { front: card.front, back: card.back ?? '' };
  }
}

export const TYPE_LABELS: Record<CardContent['type'], string> = {
  basic: 'Karteikarte',
  mc: 'Multiple Choice',
  tf: 'Richtig/Falsch',
  cloze: 'Lückentext',
  typed: 'Freitext',
};
