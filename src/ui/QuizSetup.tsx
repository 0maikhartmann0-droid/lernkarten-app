import { useMemo, useState } from 'preact/hooks';
import { loadQuizCards, quizCatalog, type QuizScope } from '../db/repo';
import type { Card } from '../db/types';
import { QUIZ_MODES, countEligible, type QuizMode } from '../modes/quiz';
import type { QuizConfig } from './Quiz';
import { loadSettings, saveSettings } from './settings';
import { useLive } from './useLive';

const COUNTS = [10, 20, 0];
const SECONDS = [0, 15, 30, 60];

// Der Bereich steckt als Text in einem <select>: "alle", "deck:<id>", "fach:<Fach>", "tag:<Tag>".
function scopeKey(scope: QuizScope): string {
  switch (scope.kind) {
    case 'deck':
      return `deck:${scope.deckId}`;
    case 'subject':
      return `fach:${scope.subject}`;
    case 'tag':
      return `tag:${scope.tag}`;
    case 'all':
      return 'alle';
  }
}

function parseScopeKey(key: string): QuizScope {
  const [kind, ...rest] = key.split(':');
  const value = rest.join(':');
  if (kind === 'deck') return { kind: 'deck', deckId: value };
  if (kind === 'fach') return { kind: 'subject', subject: value };
  if (kind === 'tag') return { kind: 'tag', tag: value };
  return { kind: 'all' };
}

interface Props {
  initialScope?: QuizScope;
  onStart: (config: QuizConfig, cards: Card[], count: number) => void;
}

export function QuizSetup({ initialScope, onStart }: Props) {
  const catalog = useLive(() => quizCatalog(), []);
  const [settings] = useState(loadSettings);
  const [key, setKey] = useState(() => (initialScope ? scopeKey(initialScope) : 'alle'));
  const [mode, setMode] = useState<QuizMode>(settings.quizMode);
  const [count, setCount] = useState(COUNTS.includes(settings.quizCount) ? settings.quizCount : 10);
  const [seconds, setSeconds] = useState(
    SECONDS.includes(settings.quizSeconds) ? settings.quizSeconds : 0,
  );

  const cards = useLive(() => loadQuizCards(parseScopeKey(key)), [key]);
  const eligible = useMemo(
    () => new Map(QUIZ_MODES.map((m) => [m.mode, cards ? countEligible(cards, m.mode) : 0])),
    [cards],
  );

  if (!catalog || !cards) return <p class="page muted">Lädt …</p>;

  if (catalog.decks.length === 0) {
    return (
      <section class="page">
        <h1>Quiz</h1>
        <p>Noch keine Decks vorhanden. Importiere zuerst ein Deck.</p>
        <a class="btn primary" href="#/">
          Zur Deckliste
        </a>
      </section>
    );
  }

  const available = eligible.get(mode) ?? 0;
  const questions = count === 0 ? available : Math.min(count, available);

  const start = (event: Event) => {
    event.preventDefault();
    if (questions === 0) return;
    saveSettings({ ...loadSettings(), quizMode: mode, quizCount: count, quizSeconds: seconds });
    onStart(
      { scope: parseScopeKey(key), mode, seconds, typoTolerance: settings.typoTolerance },
      cards,
      count,
    );
  };

  return (
    <form class="page" onSubmit={start}>
      <h1>Quiz</h1>

      <label class="field">
        Was abfragen?
        <select value={key} onChange={(e) => setKey(e.currentTarget.value)}>
          <option value="alle">Alle Decks</option>
          <optgroup label="Deck">
            {catalog.decks.map((d) => (
              <option key={d.id} value={`deck:${d.id}`}>
                {d.title}
              </option>
            ))}
          </optgroup>
          {catalog.subjects.length > 0 && (
            <optgroup label="Fach">
              {catalog.subjects.map((s) => (
                <option key={s} value={`fach:${s}`}>
                  {s}
                </option>
              ))}
            </optgroup>
          )}
          {catalog.tags.length > 0 && (
            <optgroup label="Tag">
              {catalog.tags.map((t) => (
                <option key={t} value={`tag:${t}`}>
                  #{t}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      <fieldset class="options-group">
        <legend>Modus</legend>
        {QUIZ_MODES.map((m) => {
          const n = eligible.get(m.mode) ?? 0;
          return (
            <label key={m.mode} class={`option-card ${n === 0 ? 'empty' : ''}`}>
              <input
                type="radio"
                name="mode"
                value={m.mode}
                checked={mode === m.mode}
                onChange={() => setMode(m.mode)}
              />
              <span>
                <strong>{m.label}</strong>
                <small>
                  {m.hint} · {n === 1 ? '1 Karte' : `${n} Karten`}
                </small>
              </span>
            </label>
          );
        })}
      </fieldset>

      <fieldset class="segmented">
        <legend>Anzahl Fragen</legend>
        {COUNTS.map((c) => (
          <label key={c}>
            <input type="radio" name="count" checked={count === c} onChange={() => setCount(c)} />
            <span>{c === 0 ? 'Alle' : c}</span>
          </label>
        ))}
      </fieldset>

      <fieldset class="segmented">
        <legend>Zeit pro Frage</legend>
        {SECONDS.map((s) => (
          <label key={s}>
            <input
              type="radio"
              name="seconds"
              checked={seconds === s}
              onChange={() => setSeconds(s)}
            />
            <span>{s === 0 ? 'Ohne' : `${s} s`}</span>
          </label>
        ))}
      </fieldset>

      {available === 0 ? (
        <p class="notice">
          In dieser Auswahl gibt es keine Karten für „
          {QUIZ_MODES.find((m) => m.mode === mode)?.label}“. Wähle einen anderen Modus oder Bereich.
        </p>
      ) : (
        <p class="muted">
          Falsche Antworten kommen heute beim Lernen erneut dran. Richtige zählen als „Gut“, wenn
          die Karte neu oder fällig ist.
        </p>
      )}

      <button class="btn primary big" type="submit" disabled={questions === 0}>
        Quiz starten{questions > 0 ? ` (${questions} ${questions === 1 ? 'Frage' : 'Fragen'})` : ''}
      </button>
    </form>
  );
}
