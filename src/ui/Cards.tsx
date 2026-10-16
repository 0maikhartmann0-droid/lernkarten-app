import { useMemo, useState } from 'preact/hooks';
import { listCards } from '../db/repo';
import { filterCards, tagCounts } from '../db/search';
import { CARD_TYPES, type Card, type CardType, type ReviewState } from '../db/types';
import { clozeBack } from '../modes/cloze';
import { TYPE_LABELS } from '../modes/flashcards';
import { dayNumber } from '../srs/day';
import { Rich } from './Rich';
import { toAnkiTsv } from '../export/ankiTsv';
import { exportFileName, toDeckFile } from '../export/deckJson';
import { canShareFiles, downloadFile, shareFile } from './files';
import { cardsHref, editHref, printHref, studyHref } from './routes';
import { useToast } from './toast';
import { useLive } from './useLive';

const PAGE = 50;

/** Kartenliste mit Suche und Tag-Filter – für ein Deck oder (ohne deckId) über alle Decks. */
export function Cards({ deckId }: { deckId?: string }) {
  const data = useLive(() => listCards(deckId), [deckId]);
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [type, setType] = useState<CardType | ''>('');
  const [limit, setLimit] = useState(PAGE);
  const notify = useToast();

  const sorted = useMemo(() => {
    if (!data) return [];
    if (deckId) return data.cards;
    const title = (c: Card) => data.decks.get(c.deckId)?.title ?? '';
    return [...data.cards].sort(
      (a, b) => title(a).localeCompare(title(b), 'de') || a.order - b.order,
    );
  }, [data, deckId]);
  const filtered = useMemo(
    () => filterCards(sorted, { query, tags, type }),
    [sorted, query, tags, type],
  );
  const tagList = useMemo(() => tagCounts(sorted), [sorted]);

  if (!data) return <p class="page muted">Lädt …</p>;
  const deck = deckId ? data.decks.get(deckId) : undefined;
  if (deckId && !deck) {
    return (
      <section class="page">
        <h1>Deck nicht gefunden</h1>
        <a class="btn" href="#/">
          Zur Deckliste
        </a>
      </section>
    );
  }

  const toggleTag = (tag: string) => {
    setTags((list) => (list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]));
    setLimit(PAGE);
  };
  const today = dayNumber();

  return (
    <section class="page">
      <p class="eyebrow">{deck ? 'Karten' : 'Alle Decks'}</p>
      <div class="page-head">
        <h1>{deck ? deck.title : 'Karten durchsuchen'}</h1>
        {deck && (
          <a class="btn primary" href={editHref(deck.id)}>
            Neue Karte
          </a>
        )}
      </div>

      {deck && sorted.length > 0 && (
        <details class="export">
          <summary>Exportieren und drucken</summary>
          <div class="toolbar">
            <button
              class="btn"
              type="button"
              onClick={() => {
                const name = exportFileName(deck, 'json');
                downloadFile(name, JSON.stringify(toDeckFile(deck, data.cards), null, 2));
                notify(`Deck gespeichert: ${name}`);
              }}
            >
              Deck-Datei (JSON)
            </button>
            {canShareFiles() && (
              <button
                class="btn"
                type="button"
                onClick={() =>
                  void shareFile(
                    exportFileName(deck, 'json'),
                    JSON.stringify(toDeckFile(deck, data.cards), null, 2),
                  )
                }
              >
                Deck-Datei teilen …
              </button>
            )}
            <button
              class="btn"
              type="button"
              onClick={() => {
                const name = exportFileName(deck, 'txt');
                downloadFile(name, toAnkiTsv(data.cards), 'text/tab-separated-values');
                notify(`Für Anki gespeichert: ${name}`);
              }}
            >
              Für Anki (TSV)
            </button>
            <a class="btn" href={printHref(deck.id)}>
              Druckansicht
            </a>
          </div>
          <p class="muted small">
            Die Deck-Datei enthält alle Änderungen aus der App und lässt sich hier oder auf einem
            anderen Gerät wieder importieren. Lernstände sind nicht enthalten – dafür gibt es das
            Backup in den Einstellungen.
          </p>
        </details>
      )}

      <div class="search-bar">
        <label class="field grow">
          <span class="visually-hidden">Suchen</span>
          <input
            type="search"
            placeholder="Suchen: Begriff, Einheit, Formel …"
            value={query}
            onInput={(e) => {
              setQuery(e.currentTarget.value);
              setLimit(PAGE);
            }}
          />
        </label>
        <label class="field">
          <span class="visually-hidden">Kartentyp</span>
          <select value={type} onChange={(e) => setType(e.currentTarget.value as CardType | '')}>
            <option value="">Alle Typen</option>
            {CARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tagList.length > 0 && (
        <div class="chips" role="group" aria-label="Nach Tags filtern">
          {tagList.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              class="chip-btn"
              aria-pressed={tags.includes(tag)}
              onClick={() => toggleTag(tag)}
            >
              #{tag} <small>{count}</small>
            </button>
          ))}
        </div>
      )}

      <p class="muted" aria-live="polite">
        {filtered.length === sorted.length
          ? `${sorted.length} Karten`
          : `${filtered.length} von ${sorted.length} Karten`}
        {deck && sorted.length > 0 && (
          <>
            {' · '}
            <a href={studyHref(deck.id)}>Lernen</a>
          </>
        )}
        {deck && (
          <>
            {' · '}
            <a href={cardsHref()}>Alle Decks durchsuchen</a>
          </>
        )}
      </p>

      {sorted.length === 0 && deck && (
        <div class="empty">
          <p>Dieses Deck hat noch keine Karten.</p>
          <a class="btn primary" href={editHref(deck.id)}>
            Erste Karte anlegen
          </a>
        </div>
      )}

      <ul class="card-list">
        {filtered.slice(0, limit).map((card) => (
          <li key={card.key}>
            <a class="card-row" href={editHref(card.deckId, card.id)}>
              <span class="card-row-head">
                <span class="type-badge">{TYPE_LABELS[card.type]}</span>
                <span class="muted">{status(data.states.get(card.key), today)}</span>
                {!deck && (
                  <span class="muted card-row-deck">{data.decks.get(card.deckId)?.title}</span>
                )}
              </span>
              <Rich text={card.type === 'cloze' ? clozeBack(card.front) : card.front} />
              {card.tags.length > 0 && (
                <span class="card-row-tags">{card.tags.map((t) => `#${t}`).join(' ')}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
      {filtered.length > limit && (
        <button class="btn" type="button" onClick={() => setLimit((n) => n + PAGE)}>
          Weitere {Math.min(PAGE, filtered.length - limit)} anzeigen
        </button>
      )}
    </section>
  );
}

function status(state: ReviewState | undefined, today: number): string {
  if (!state) return 'neu';
  const days = state.due - today;
  if (days <= 0) return 'heute fällig';
  if (days === 1) return 'morgen fällig';
  return `in ${days} Tagen fällig`;
}
