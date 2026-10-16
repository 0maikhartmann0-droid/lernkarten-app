import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Card } from '../db/types';
import { choiceLabel } from '../modes/flashcards';
import type { Question } from '../modes/quiz';
import { checkTyped, type TypedVerdict } from '../modes/typed';
import { Rich } from './Rich';
import { TrainToggle } from './TrainToggle';

export interface QuizAnswer {
  question: Question;
  correct: boolean;
  /** Was eingegeben bzw. gewählt wurde, als Klartext */
  given: string;
  note?: 'tippfehler' | 'zeit' | 'gewertet';
  /** Hat die Antwort die Lernplanung verändert? */
  scheduled: boolean;
}

interface Check {
  correct: boolean;
  given: string;
  note?: QuizAnswer['note'];
  selected?: number;
  gaps?: TypedVerdict[];
}

interface Props {
  questions: Question[];
  /** Sekunden pro Frage, 0 = ohne Zeitlimit */
  seconds: number;
  typoTolerance: boolean;
  record: (card: Card, correct: boolean) => Promise<boolean>;
  onFinish: (answers: QuizAnswer[]) => void;
}

export function QuizRunner({ questions, seconds, typoTolerance, record, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [check, setCheck] = useState<Check | null>(null);
  const [inputs, setInputs] = useState<string[]>([]);
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;
  const [revealed, setRevealed] = useState(false);
  const [left, setLeft] = useState(seconds);
  const firstInput = useRef<HTMLInputElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  // Wie beim Lernen: sofort wirksame Sperre gegen doppeltes Weiterschalten, gelöst bei der nächsten Frage.
  const saving = useRef(false);

  const question = questions[index];
  const last = index === questions.length - 1;

  useEffect(() => {
    saving.current = false;
    setLeft(seconds);
    firstInput.current?.focus();
  }, [index, seconds]);

  useEffect(() => {
    if (check) nextButton.current?.focus();
  }, [check]);

  // Zeitmodus: Läuft die Zeit ab, gilt die Frage als falsch beantwortet.
  useEffect(() => {
    if (seconds === 0 || check) return;
    const deadline = Date.now() + seconds * 1000;
    const timer = setInterval(() => {
      const rest = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(rest);
      if (rest === 0) {
        clearInterval(timer);
        const given = inputsRef.current.filter(Boolean).join(' · ') || '—';
        setCheck({ correct: false, given, note: 'zeit' });
      }
    }, 250);
    return () => clearInterval(timer);
  }, [index, seconds, check]);

  const advance = useCallback(
    async (result: Check) => {
      if (!question || saving.current) return;
      saving.current = true;
      try {
        const scheduled = await record(question.card, result.correct);
        const answer: QuizAnswer = {
          question,
          correct: result.correct,
          given: result.given,
          scheduled,
        };
        if (result.note) answer.note = result.note;
        const list = [...answers, answer];
        if (last) {
          onFinish(list);
          return;
        }
        setAnswers(list);
        setCheck(null);
        setInputs([]);
        setRevealed(false);
        setIndex((i) => i + 1);
        window.scrollTo(0, 0);
      } catch (error) {
        saving.current = false;
        throw error;
      }
    },
    [question, answers, last, record, onFinish],
  );

  const choose = useCallback(
    (selected: number) => {
      if (!question || check) return;
      if (question.kind === 'choice' && selected < question.options.length) {
        setCheck({
          correct: selected === question.correct,
          given: question.options[selected]!,
          selected,
        });
      } else if (question.kind === 'tf' && selected < 2) {
        const value = selected === 0;
        setCheck({
          correct: value === question.answer,
          given: value ? 'Richtig' : 'Falsch',
          selected,
        });
      }
    },
    [question, check],
  );

  const submitText = (event: Event) => {
    event.preventDefault();
    if (!question || check) return;
    if (question.kind === 'typed') {
      const verdict = checkTyped(inputs[0] ?? '', question.answer, typoTolerance);
      setCheck(withVerdicts(inputs[0] ?? '', [verdict]));
    } else if (question.kind === 'cloze') {
      const verdicts = question.gaps.map((gap, i) =>
        checkTyped(inputs[i] ?? '', gap.answer, typoTolerance),
      );
      setCheck(withVerdicts(question.gaps.map((_, i) => inputs[i] || '—').join(' · '), verdicts));
    }
  };

  // Tastatur: 1–4 wählt eine Antwort, Enter schaltet nach der Auswertung weiter.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!question || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, dialog')) return;
      // Ein fokussierter Button oder Link löst Enter selbst aus.
      if (check && event.key === 'Enter' && !target?.closest('button, a')) {
        event.preventDefault();
        void advance(check);
      } else if (!check && /^[1-9]$/.test(event.key)) {
        choose(Number(event.key) - 1);
      } else if (!check && question.kind === 'tf' && /^[rf]$/i.test(event.key)) {
        choose(event.key.toLowerCase() === 'r' ? 0 : 1);
      } else if (!check && question.kind === 'self' && !revealed && event.key === ' ') {
        event.preventDefault();
        setRevealed(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, check, revealed, advance, choose]);

  if (!question) return null;

  const score = answers.filter((a) => a.correct).length;
  const explain = question.card.explain;

  return (
    <section class="quiz">
      <div class="study-top">
        <span class="study-title">
          Frage {index + 1} von {questions.length}
        </span>
        <span class="muted">{score} richtig</span>
        <TrainToggle />
        <button class="btn quiet" type="button" onClick={() => onFinish(answers)}>
          Beenden
        </button>
      </div>
      {seconds > 0 && (
        <div class={`timer ${left <= 5 ? 'urgent' : ''}`} aria-label={`Noch ${left} Sekunden`}>
          <span style={{ width: `${(left / seconds) * 100}%` }} />
          <small>{check ? '' : `${left} s`}</small>
        </div>
      )}

      <article class="card">
        {question.kind === 'self' ? (
          <Rich text={question.front} class="face" />
        ) : (
          <Rich text={question.prompt} class="face" />
        )}
        {question.card.image?.startsWith('data:image/') && (
          <img class="card-image" src={question.card.image} alt="" />
        )}
      </article>

      {question.kind === 'choice' && (
        <div class="options" role="group" aria-label="Antwortmöglichkeiten">
          {question.options.map((option, i) => (
            <button
              key={`${index}-${i}`}
              type="button"
              class={`option ${optionState(check, i, question.correct)}`}
              disabled={check !== null}
              onClick={() => choose(i)}
            >
              <span class="option-key">{choiceLabel(i)}</span>
              <Rich text={option} inline />
            </button>
          ))}
        </div>
      )}

      {question.kind === 'tf' && (
        <div class="options two" role="group" aria-label="Ist die Aussage richtig?">
          {['Richtig', 'Falsch'].map((label, i) => (
            <button
              key={label}
              type="button"
              class={`option ${optionState(check, i, question.answer ? 0 : 1)}`}
              disabled={check !== null}
              onClick={() => choose(i)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {(question.kind === 'typed' || question.kind === 'cloze') && (
        <form class="answer-form" onSubmit={submitText}>
          {(question.kind === 'typed' ? [{ answer: question.answer }] : question.gaps).map(
            (_, i) => (
              <label key={`${index}-${i}`} class="field">
                {question.kind === 'typed' ? 'Deine Antwort' : `Lücke ${i + 1}`}
                <input
                  ref={i === 0 ? firstInput : undefined}
                  type="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellcheck={false}
                  enterKeyHint="done"
                  value={inputs[i] ?? ''}
                  disabled={check !== null}
                  class={check?.gaps ? (check.gaps[i] === 'falsch' ? 'wrong' : 'right') : ''}
                  onInput={(e) => {
                    const value = e.currentTarget.value;
                    setInputs((list) => {
                      const next = [...list];
                      next[i] = value;
                      return next;
                    });
                  }}
                />
              </label>
            ),
          )}
          {!check && (
            <button class="btn primary big" type="submit">
              Prüfen
            </button>
          )}
        </form>
      )}

      {question.kind === 'self' && !check && (
        <div class="stack">
          {revealed ? (
            <>
              <div class="card solution">
                <Rich text={question.back} class="face" />
              </div>
              <div class="options two" role="group" aria-label="Wusstest du es?">
                <button
                  type="button"
                  class="option wrong-choice"
                  onClick={() => advance({ correct: false, given: 'Nicht gewusst' })}
                >
                  Nicht gewusst
                </button>
                <button
                  type="button"
                  class="option right-choice"
                  onClick={() => advance({ correct: true, given: 'Gewusst' })}
                >
                  Gewusst
                </button>
              </div>
            </>
          ) : (
            <button class="btn primary big" type="button" onClick={() => setRevealed(true)}>
              Lösung zeigen
            </button>
          )}
        </div>
      )}

      {check && (
        <div class="feedback" role="status" aria-live="polite">
          <p class={`verdict ${check.correct ? 'ok' : 'bad'}`}>{verdictText(check)}</p>
          <Solution question={question} />
          {explain && (
            <div class="explain">
              <span class="eyebrow">Erklärung</span>
              <Rich text={explain} />
            </div>
          )}
          {question.card.source && <p class="source">Quelle: {question.card.source}</p>}
          <div class="feedback-actions">
            {!check.correct && check.note !== 'zeit' && check.gaps && (
              <button
                class="btn"
                type="button"
                onClick={() => setCheck({ ...check, correct: true, note: 'gewertet' })}
              >
                Doch richtig
              </button>
            )}
            <button
              ref={nextButton}
              class="btn primary big"
              type="button"
              onClick={() => advance(check)}
            >
              {last ? 'Zur Auswertung' : 'Weiter'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function withVerdicts(given: string, gaps: TypedVerdict[]): Check {
  const correct = gaps.every((v) => v !== 'falsch');
  const check: Check = { correct, given, gaps };
  if (correct && gaps.includes('tippfehler')) check.note = 'tippfehler';
  return check;
}

function optionState(check: Check | null, i: number, correct: number): string {
  if (!check) return '';
  if (i === correct) return 'is-correct';
  return i === check.selected ? 'is-wrong' : 'is-dim';
}

function verdictText(check: Check): string {
  if (check.note === 'zeit') return 'Zeit abgelaufen';
  if (check.note === 'gewertet') return 'Als richtig gewertet';
  if (check.note === 'tippfehler') return 'Richtig – mit kleinem Tippfehler';
  return check.correct ? 'Richtig!' : 'Leider falsch';
}

function Solution({ question }: { question: Question }) {
  switch (question.kind) {
    case 'typed':
      return (
        <p class="solution-line">
          Lösung: <Rich text={question.answer} inline />
        </p>
      );
    case 'cloze':
      return <Rich text={question.solution} class="solution-text" />;
    case 'tf':
      return <p class="solution-line">Die Aussage ist {question.answer ? 'richtig' : 'falsch'}.</p>;
    case 'self':
      return <Rich text={question.back} class="solution-text" />;
    case 'choice':
      return null;
  }
}
