import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { db } from '../db/db';
import { deleteCard, saveCard } from '../db/repo';
import { CARD_TYPES, cardKey, type Card, type CardType, type Deck } from '../db/types';
import { checkCard } from '../import/validation';
import { parseCloze } from '../modes/cloze';
import { TYPE_LABELS, cardFaces } from '../modes/flashcards';
import { imageToDataUri } from './files';
import { Modal } from './Modal';
import { Rich } from './Rich';
import { cardsHref } from './routes';
import { useToast } from './toast';

interface Draft {
  type: CardType;
  front: string;
  back: string;
  choices: string[];
  correct: number;
  truth: boolean;
  explain: string;
  tags: string;
  source: string;
  image: string;
}

const FRONT_LABEL: Record<CardType, string> = {
  basic: 'Frage (Vorderseite)',
  mc: 'Frage',
  tf: 'Aussage',
  cloze: 'Text mit Lücken',
  typed: 'Frage',
};

const MAX_CHOICES = 8;

function toDraft(card?: Card): Draft {
  return {
    type: card?.type ?? 'basic',
    front: card?.front ?? '',
    back: card?.back ?? '',
    choices: card?.choices ? [...card.choices] : ['', '', '', ''],
    correct: typeof card?.answer === 'number' ? card.answer : 0,
    truth: card?.answer !== false,
    explain: card?.explain ?? '',
    tags: card?.tags.join(', ') ?? '',
    source: card?.source ?? '',
    image: card?.image ?? '',
  };
}

/** Nur die Felder, die zum Kartentyp gehören – im selben Format wie im Deck-JSON. */
function toContent(draft: Draft): Record<string, unknown> {
  const content: Record<string, unknown> = {
    type: draft.type,
    front: draft.front,
    tags: draft.tags
      .split(/[\s,;]+/)
      .map((t) => t.replace(/^#/, ''))
      .filter(Boolean),
  };
  if (draft.type === 'basic' || draft.type === 'typed') content.back = draft.back;
  if (draft.type === 'mc') {
    content.choices = draft.choices;
    content.answer = draft.correct;
  }
  if (draft.type === 'tf') content.answer = draft.truth;
  if (draft.explain.trim()) content.explain = draft.explain;
  if (draft.source.trim()) content.source = draft.source;
  if (draft.image) content.image = draft.image;
  return content;
}

export function CardEditor({ deckId, cardId }: { deckId: string; cardId?: string }) {
  const notify = useToast();
  // undefined = lädt, null = nicht gefunden
  const [deck, setDeck] = useState<Deck | null>();
  const [card, setCard] = useState<Card | null>();
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const frontRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void (async () => {
      const [foundDeck, foundCard] = await Promise.all([
        db.decks.get(deckId),
        cardId ? db.cards.get(cardKey(deckId, cardId)) : Promise.resolve(undefined),
      ]);
      setDeck(foundDeck ?? null);
      setCard(cardId ? (foundCard ?? null) : undefined);
      setDraft(toDraft(foundCard));
    })();
  }, [deckId, cardId]);

  const preview = useMemo(() => {
    const check = checkCard(toContent(draft));
    return check.ok ? cardFaces({ ...check.card, id: 'vorschau' }) : null;
  }, [draft]);

  if (deck === undefined || (cardId && card === undefined)) return <p class="page muted">Lädt …</p>;
  if (deck === null || card === null) {
    return (
      <section class="page">
        <h1>Karte nicht gefunden</h1>
        <a class="btn" href={deck ? cardsHref(deck.id) : '#/'}>
          Zurück
        </a>
      </section>
    );
  }

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors([]);
  };
  const back = () => {
    location.hash = cardsHref(deckId);
  };

  const save = async (event: Event) => {
    event.preventDefault();
    const check = checkCard(toContent(draft));
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    await saveCard(deckId, check.card, card?.key);
    notify(card ? 'Karte gespeichert.' : 'Karte angelegt.');
    back();
  };

  const remove = async () => {
    if (!card) return;
    await deleteCard(card.key);
    notify('Karte gelöscht.', 'info');
    back();
  };

  // Markierten Text zur nächsten Lücke machen – auf dem Handy einfacher als {{c1::…}} zu tippen.
  const makeGap = () => {
    const area = frontRef.current;
    if (!area) return;
    const { selectionStart: start, selectionEnd: end, value } = area;
    const used = parseCloze(value).flatMap((s) => (s.kind === 'cloze' ? [s.index] : []));
    const next = Math.max(0, ...used) + 1;
    const selected = value.slice(start, end) || 'Antwort';
    set({ front: `${value.slice(0, start)}{{c${next}::${selected}}}${value.slice(end)}` });
  };

  const pickImage = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      set({ image: await imageToDataUri(file) });
    } catch {
      notify('Das Bild konnte nicht gelesen werden.', 'error');
    }
  };

  const updateChoice = (i: number, value: string) =>
    set({ choices: draft.choices.map((c, j) => (j === i ? value : c)) });
  const removeChoice = (i: number) =>
    set({
      choices: draft.choices.filter((_, j) => j !== i),
      correct: draft.correct === i ? 0 : draft.correct > i ? draft.correct - 1 : draft.correct,
    });

  return (
    <form class="page editor" onSubmit={save}>
      <p class="eyebrow">{deck.title}</p>
      <h1>{card ? 'Karte bearbeiten' : 'Neue Karte'}</h1>
      {card?.editedAt === undefined && card && (
        <p class="muted">
          Diese Karte stammt aus einer Deck-Datei. Wird die Datei erneut importiert, ersetzt sie
          deine Änderungen – die App fragt dann vorher nach.
        </p>
      )}

      <label class="field">
        Kartentyp
        <select
          value={draft.type}
          onChange={(e) => set({ type: e.currentTarget.value as CardType })}
        >
          {CARD_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label class="field wide">
        {FRONT_LABEL[draft.type]}
        <textarea
          ref={frontRef}
          rows={draft.type === 'cloze' ? 4 : 3}
          value={draft.front}
          onInput={(e) => set({ front: e.currentTarget.value })}
        />
      </label>
      {draft.type === 'cloze' && (
        <div class="hint-row">
          <button class="btn" type="button" onClick={makeGap}>
            Markierung zur Lücke machen
          </button>
          <small class="muted">
            Oder selbst schreiben: {'{{c1::Antwort}}'}, mit Hinweis {'{{c1::Antwort::Hinweis}}'}
          </small>
        </div>
      )}

      {(draft.type === 'basic' || draft.type === 'typed') && (
        <label class="field wide">
          {draft.type === 'typed'
            ? 'Antwort (wird eingetippt – kurz halten)'
            : 'Antwort (Rückseite)'}
          <textarea
            rows={draft.type === 'typed' ? 1 : 3}
            value={draft.back}
            onInput={(e) => set({ back: e.currentTarget.value })}
          />
        </label>
      )}

      {draft.type === 'mc' && (
        <fieldset class="choice-editor">
          <legend>Antwortmöglichkeiten – die richtige auswählen</legend>
          {draft.choices.map((choice, i) => (
            <div key={i} class="choice-row">
              <input
                type="radio"
                name="correct"
                aria-label={`Antwort ${i + 1} ist richtig`}
                checked={draft.correct === i}
                onChange={() => set({ correct: i })}
              />
              <input
                type="text"
                aria-label={`Antwort ${i + 1}`}
                value={choice}
                onInput={(e) => updateChoice(i, e.currentTarget.value)}
              />
              <button
                class="btn quiet"
                type="button"
                aria-label={`Antwort ${i + 1} entfernen`}
                disabled={draft.choices.length <= 2}
                onClick={() => removeChoice(i)}
              >
                ✕
              </button>
            </div>
          ))}
          {draft.choices.length < MAX_CHOICES && (
            <button
              class="btn"
              type="button"
              onClick={() => set({ choices: [...draft.choices, ''] })}
            >
              Antwort hinzufügen
            </button>
          )}
        </fieldset>
      )}

      {draft.type === 'tf' && (
        <fieldset class="segmented">
          <legend>Die Aussage ist …</legend>
          {[true, false].map((value) => (
            <label key={String(value)}>
              <input
                type="radio"
                name="truth"
                checked={draft.truth === value}
                onChange={() => set({ truth: value })}
              />
              <span>{value ? 'richtig' : 'falsch'}</span>
            </label>
          ))}
        </fieldset>
      )}

      <label class="field wide">
        Erklärung (optional)
        <textarea
          rows={2}
          value={draft.explain}
          onInput={(e) => set({ explain: e.currentTarget.value })}
        />
      </label>
      <p class="muted small">
        Markdown und Formeln sind erlaubt, z. B. **fett** oder $R = \frac{'{d}{\\lambda}'}$.
      </p>

      <div class="two-fields">
        <label class="field">
          Tags (mit Komma getrennt)
          <input
            type="text"
            autoCapitalize="off"
            value={draft.tags}
            onInput={(e) => set({ tags: e.currentTarget.value })}
          />
        </label>
        <label class="field">
          Quelle (optional)
          <input
            type="text"
            value={draft.source}
            placeholder="z. B. Folie 12"
            onInput={(e) => set({ source: e.currentTarget.value })}
          />
        </label>
      </div>

      <div class="field wide">
        Bild (optional)
        {draft.image.startsWith('data:image/') ? (
          <div class="image-edit">
            <img src={draft.image} alt="Bild der Karte" />
            <button class="btn quiet danger" type="button" onClick={() => set({ image: '' })}>
              Bild entfernen
            </button>
          </div>
        ) : (
          draft.image && (
            <p class="muted">
              Das Bild „{draft.image}“ fehlt auf diesem Gerät. Wähle es neu aus oder importiere es
              zusammen mit der Deck-Datei.
            </p>
          )
        )}
        <label class="btn">
          {draft.image ? 'Anderes Bild wählen' : 'Bild oder Foto hinzufügen'}
          <input class="visually-hidden" type="file" accept="image/*" onChange={pickImage} />
        </label>
      </div>

      {errors.length > 0 && (
        <div class="notice error" role="alert">
          <strong>Noch nicht speicherbar</strong>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {preview && (
        <section class="preview" aria-label="Vorschau">
          <p class="eyebrow">Vorschau</p>
          <div class="card">
            <Rich text={preview.front} class="face" />
            <hr />
            <Rich text={preview.back} class="face" />
          </div>
        </section>
      )}

      <div class="editor-actions">
        <button class="btn primary big" type="submit">
          Speichern
        </button>
        <a class="btn" href={cardsHref(deckId)}>
          Abbrechen
        </a>
        {card && (
          <button class="btn quiet danger" type="button" onClick={() => setConfirmDelete(true)}>
            Karte löschen
          </button>
        )}
      </div>

      {confirmDelete && (
        <Modal title="Karte löschen?" onClose={() => setConfirmDelete(false)}>
          <p>Die Karte und ihr Lernstand werden von diesem Gerät gelöscht.</p>
          <div class="modal-actions">
            <button class="btn" type="button" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </button>
            <button class="btn danger-solid" type="button" onClick={remove}>
              Löschen
            </button>
          </div>
        </Modal>
      )}
    </form>
  );
}
