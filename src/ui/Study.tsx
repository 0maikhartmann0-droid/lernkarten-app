import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { loadSession, recordReview, type Session } from '../db/repo';
import { cardFaces } from '../modes/flashcards';
import { dayNumber } from '../srs/day';
import { requeue } from '../srs/queue';
import {
  RATINGS,
  RATING_LABELS,
  formatInterval,
  newState,
  previewIntervals,
  type Rating,
} from '../srs/sm2';
import { statsHref } from './routes';
import { Rich } from './Rich';
import { loadSettings } from './settings';
import { TrainToggle } from './TrainToggle';

const EXTRA_NEW = 10;
const RATING_CLASS: Record<Rating, string> = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };

export function Study({ deckId }: { deckId: string }) {
  // undefined = lädt noch, null = Deck nicht gefunden
  const [session, setSession] = useState<Session | null>();
  const [queue, setQueue] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  // Sofort wirksame Sperre: busy greift erst nach dem nächsten Rendern, ein schneller zweiter
  // Tastendruck würde dieselbe Karte sonst doppelt bewerten. Gelöst wird sie erst, wenn die
  // nächste Karte gezeichnet ist.
  const saving = useRef(false);
  useEffect(() => {
    saving.current = false;
  }, [queue]);
  const [done, setDone] = useState(0);
  const [again, setAgain] = useState(0);

  const load = useCallback(
    async (extraNew = 0) => {
      const next = await loadSession(deckId, loadSettings(), new Date(), extraNew);
      setSession(next ?? null);
      setQueue(next?.queue ?? []);
      setRevealed(false);
    },
    [deckId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const currentKey = queue[0];
  const card = session && currentKey !== undefined ? session.cards.get(currentKey) : undefined;

  const rate = useCallback(
    async (rating: Rating) => {
      if (!session || !card || saving.current) return;
      saving.current = true;
      setBusy(true);
      try {
        const state = await recordReview(card, rating);
        session.states.set(card.key, state);
        setQueue((q) => requeue(q, rating));
        setDone((n) => n + 1);
        if (rating === 1) setAgain((n) => n + 1);
        setRevealed(false);
        window.scrollTo(0, 0);
      } catch (error) {
        saving.current = false;
        throw error;
      } finally {
        setBusy(false);
      }
    },
    [session, card],
  );

  // Laptop: Leertaste deckt auf (danach = "Gut"), 1–4 bewerten.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!card || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, dialog')) return;
      if (event.key === ' ' || event.key === 'Enter') {
        // Ein fokussierter Link oder Button behält seine eigene Enter-Funktion.
        if (event.key === 'Enter' && target?.closest('a, button')) return;
        event.preventDefault();
        if (revealed) void rate(3);
        else setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        void rate(Number(event.key) as Rating);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, revealed, rate]);

  const faces = useMemo(() => (card ? cardFaces(card) : undefined), [card]);

  if (session === undefined) return <p class="page muted">Lädt …</p>;
  if (session === null) {
    return (
      <section class="page">
        <h1>Deck nicht gefunden</h1>
        <a class="btn" href="#/">
          Zur Deckliste
        </a>
      </section>
    );
  }

  if (!card || !faces) {
    return (
      <section class="page finished">
        <p class="eyebrow">{session.deck.title}</p>
        <h1>{done > 0 ? 'Geschafft!' : 'Für heute ist nichts fällig'}</h1>
        {done > 0 && (
          <p>
            {done} Bewertung(en) in dieser Sitzung, davon {again}× „Nochmal“.
          </p>
        )}
        {session.waitingReview > 0 && (
          <p class="muted">
            {session.waitingReview} fällige Karte(n) warten wegen des Tageslimits bis morgen.
          </p>
        )}
        {session.waitingNew > 0 && (
          <p class="muted">
            {session.waitingNew} neue Karte(n) sind noch nicht gelernt – das Tageslimit für neue
            Karten ist erreicht.
          </p>
        )}
        <div class="stack">
          {session.waitingNew > 0 && (
            <button class="btn primary" type="button" onClick={() => load(EXTRA_NEW)}>
              {Math.min(EXTRA_NEW, session.waitingNew)} weitere neue Karten lernen
            </button>
          )}
          <a class="btn" href={statsHref(deckId)}>
            Statistik ansehen
          </a>
          <a class="btn" href="#/">
            Zur Deckliste
          </a>
        </div>
      </section>
    );
  }

  const today = dayNumber();
  const intervals = previewIntervals(session.states.get(card.key) ?? newState(today), today);
  const total = done + queue.length;

  return (
    <section class="study">
      <div class="study-top">
        <a class="back" href="#/" aria-label="Zurück zur Deckliste">
          ← Decks
        </a>
        <span class="study-title">{session.deck.title}</span>
        <span class="muted">noch {queue.length}</span>
        <TrainToggle />
      </div>
      <progress class="progress" max={total} value={done} aria-label="Fortschritt der Sitzung" />

      {/* Antippen der Karte deckt auf – praktisch mit einer Hand; der Button bleibt für Tastatur und Screenreader. */}
      <article class={`card ${revealed ? '' : 'tappable'}`} onClick={() => setRevealed(true)}>
        <Rich text={faces.front} class="face" />
        {card.image?.startsWith('data:image/') && (
          <img class="card-image" src={card.image} alt="" />
        )}
        {revealed && (
          <div class="answer" aria-live="polite">
            <hr />
            <Rich text={faces.back} class="face" />
            {card.explain && (
              <div class="explain">
                <span class="eyebrow">Erklärung</span>
                <Rich text={card.explain} />
              </div>
            )}
            {card.source && <p class="source">Quelle: {card.source}</p>}
          </div>
        )}
      </article>

      <div class="study-actions">
        {revealed ? (
          <div class="ratings" role="group" aria-label="Wie gut wusstest du die Antwort?">
            {RATINGS.map((rating) => (
              <button
                key={rating}
                class={`rating ${RATING_CLASS[rating]}`}
                type="button"
                disabled={busy}
                onClick={() => rate(rating)}
              >
                <span>{RATING_LABELS[rating]}</span>
                <small>{formatInterval(intervals[rating])}</small>
              </button>
            ))}
          </div>
        ) : (
          <button class="btn primary reveal" type="button" onClick={() => setRevealed(true)}>
            Antwort zeigen
          </button>
        )}
        <p class="keys muted">Tastatur: Leertaste = aufdecken / „Gut“ · 1–4 = bewerten</p>
      </div>
    </section>
  );
}
