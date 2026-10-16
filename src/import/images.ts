import type { CardContent } from '../db/types';

/** Dateiname ohne Ordner, Query und Groß-/Kleinschreibung: "bilder/Abb 1.PNG" → "abb 1.png". */
export function imageName(path: string): string {
  const clean = path.split(/[?#]/)[0] ?? '';
  const base = clean.split(/[\\/]/).pop() ?? '';
  try {
    return decodeURIComponent(base).toLowerCase();
  } catch {
    return base.toLowerCase();
  }
}

export interface MissingImage {
  cardId: string;
  path: string;
}

/**
 * Ersetzt relative Bildpfade durch die mitgelieferten Bilder (Dateiname → data-URI).
 * Karten, deren Bild nicht dabei ist, behalten den Pfad und werden als fehlend gemeldet.
 */
export function resolveImages(
  cards: readonly CardContent[],
  images: ReadonlyMap<string, string>,
): { cards: CardContent[]; missing: MissingImage[] } {
  const missing: MissingImage[] = [];
  const resolved = cards.map((card) => {
    if (!card.image || card.image.startsWith('data:')) return card;
    const data = images.get(imageName(card.image));
    if (data) return { ...card, image: data };
    missing.push({ cardId: card.id, path: card.image });
    return card;
  });
  return { cards: resolved, missing };
}
