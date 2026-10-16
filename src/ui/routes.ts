export type Route =
  | { name: 'decks' }
  | { name: 'study'; deckId: string }
  | { name: 'stats'; deckId: string }
  | { name: 'quiz'; deckId?: string }
  | { name: 'cards'; deckId?: string }
  | { name: 'edit'; deckId: string; cardId?: string }
  | { name: 'print'; deckId: string }
  | { name: 'settings' };

// Hash-Routing: funktioniert ohne Server-Konfiguration und offline aus dem Cache.
export function parseHash(hash: string): Route {
  const [, section, id, sub] = hash.split('/');
  const deckId = id ? decodeURIComponent(id) : '';
  if (section === 'lernen' && deckId) return { name: 'study', deckId };
  if (section === 'statistik' && deckId) return { name: 'stats', deckId };
  if (section === 'quiz') return deckId ? { name: 'quiz', deckId } : { name: 'quiz' };
  if (section === 'karten' && deckId && sub === 'neu') return { name: 'edit', deckId };
  if (section === 'karten' && deckId && sub) {
    return { name: 'edit', deckId, cardId: decodeURIComponent(sub) };
  }
  if (section === 'karten') return deckId ? { name: 'cards', deckId } : { name: 'cards' };
  if (section === 'drucken' && deckId) return { name: 'print', deckId };
  if (section === 'einstellungen') return { name: 'settings' };
  return { name: 'decks' };
}

export const studyHref = (deckId: string) => `#/lernen/${encodeURIComponent(deckId)}`;
export const statsHref = (deckId: string) => `#/statistik/${encodeURIComponent(deckId)}`;
export const quizHref = (deckId?: string) =>
  deckId ? `#/quiz/${encodeURIComponent(deckId)}` : '#/quiz';
export const cardsHref = (deckId?: string) =>
  deckId ? `#/karten/${encodeURIComponent(deckId)}` : '#/karten';
export const editHref = (deckId: string, cardId?: string) =>
  `#/karten/${encodeURIComponent(deckId)}/${cardId ? encodeURIComponent(cardId) : 'neu'}`;
export const printHref = (deckId: string) => `#/drucken/${encodeURIComponent(deckId)}`;
