import type { Card, CardType } from './types';

export interface CardFilter {
  query: string;
  /** Karte muss alle diese Tags tragen */
  tags: readonly string[];
  type: CardType | '';
}

/** Kleinbuchstaben, Umlaute als ae/oe/ue/ss, Leerraum zusammengefasst – "Wärme" findet "waerme". */
export function foldText(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

function haystack(card: Card): string {
  return foldText(
    [
      card.front,
      card.back ?? '',
      card.explain ?? '',
      ...(card.choices ?? []),
      ...card.tags,
      card.source ?? '',
    ].join('\n'),
  );
}

/** Alle Suchwörter müssen vorkommen (in beliebiger Reihenfolge und beliebigem Feld). */
export function filterCards(cards: readonly Card[], filter: CardFilter): Card[] {
  const words = foldText(filter.query).split(' ').filter(Boolean);
  return cards.filter((card) => {
    if (filter.type && card.type !== filter.type) return false;
    if (!filter.tags.every((t) => card.tags.includes(t))) return false;
    if (words.length === 0) return true;
    const text = haystack(card);
    return words.every((w) => text.includes(w));
  });
}

/** Tags mit Anzahl, häufigste zuerst. */
export function tagCounts(cards: readonly Card[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const tag of card.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'));
}
