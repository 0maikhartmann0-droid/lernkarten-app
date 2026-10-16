import { useState } from 'preact/hooks';
import { listCards } from '../db/repo';
import { cardFaces } from '../modes/flashcards';
import { Rich } from './Rich';
import { cardsHref } from './routes';
import { useLive } from './useLive';

/** Druckansicht eines Decks; "Als PDF speichern" geht über den Druckdialog des Browsers. */
export function PrintView({ deckId }: { deckId: string }) {
  const data = useLive(() => listCards(deckId), [deckId]);
  const [answers, setAnswers] = useState(true);
  const [explain, setExplain] = useState(true);

  if (!data) return <p class="page muted">Lädt …</p>;
  const deck = data.decks.get(deckId);
  if (!deck) {
    return (
      <section class="page">
        <h1>Deck nicht gefunden</h1>
        <a class="btn" href="#/">
          Zur Deckliste
        </a>
      </section>
    );
  }

  return (
    <section class="page print-page">
      <div class="no-print stack">
        <a class="back" href={cardsHref(deckId)}>
          ← Zurück zu den Karten
        </a>
        <label class="check">
          <input
            type="checkbox"
            checked={answers}
            onChange={(e) => setAnswers(e.currentTarget.checked)}
          />
          <span>
            Antworten drucken
            <small>Ohne Antworten wird es ein Übungsblatt zum Selbsttest.</small>
          </span>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={explain}
            disabled={!answers}
            onChange={(e) => setExplain(e.currentTarget.checked)}
          />
          <span>Erklärungen und Quellen drucken</span>
        </label>
        <button class="btn primary big" type="button" onClick={() => window.print()}>
          Drucken / als PDF speichern
        </button>
        <p class="muted">
          Im Druckdialog als Ziel „Als PDF speichern“ wählen, um eine PDF-Datei zu erhalten.
        </p>
      </div>

      <header class="print-head">
        <h1>{deck.title}</h1>
        <p class="muted">
          {[
            deck.subject,
            `${data.cards.length} Karten`,
            `Stand ${new Date().toLocaleDateString('de-DE')}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <ol class={`print-cards ${answers ? '' : 'questions-only'}`}>
        {data.cards.map((card, i) => {
          const faces = cardFaces(card);
          return (
            <li key={card.key} class="print-card">
              <div class="print-q">
                <span class="print-n">{i + 1}</span>
                <Rich text={faces.front} />
                {card.image?.startsWith('data:image/') && <img src={card.image} alt="" />}
              </div>
              {answers && (
                <div class="print-a">
                  <Rich text={faces.back} />
                  {explain && card.explain && <Rich text={card.explain} class="print-e" />}
                  {explain && card.source && <p class="print-e">Quelle: {card.source}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
