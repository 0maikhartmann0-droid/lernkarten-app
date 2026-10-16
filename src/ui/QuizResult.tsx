import type { Question } from '../modes/quiz';
import type { QuizAnswer } from './QuizRunner';
import { Rich } from './Rich';

interface Props {
  answers: QuizAnswer[];
  /** Dauer in Millisekunden */
  duration: number;
  onRetryWrong: () => void;
  onRestart: () => void;
}

export function QuizResult({ answers, duration, onRetryWrong, onRestart }: Props) {
  const correct = answers.filter((a) => a.correct).length;
  const wrong = answers.length - correct;
  const scheduled = answers.filter((a) => a.scheduled).length;
  const percent = answers.length ? Math.round((correct / answers.length) * 100) : 0;

  return (
    <section class="page">
      <p class="eyebrow">Auswertung</p>
      <h1>
        {answers.length === 0
          ? 'Keine Frage beantwortet'
          : `${correct} von ${answers.length} richtig`}
      </h1>

      {answers.length > 0 && (
        <dl class="tiles">
          <div class="tile">
            <dt>Quote</dt>
            <dd data-testid="quiz-quote">{percent} %</dd>
          </div>
          <div class="tile">
            <dt>Falsch</dt>
            <dd>{wrong}</dd>
          </div>
          <div class="tile">
            <dt>Zeit</dt>
            <dd>{formatDuration(duration)}</dd>
          </div>
        </dl>
      )}
      {scheduled > 0 && (
        <p class="muted">
          {scheduled} Karte(n) in der Lernplanung aktualisiert.
          {wrong > 0 && ' Falsch beantwortete kommen heute beim Lernen erneut dran.'}
        </p>
      )}

      <div class="stack">
        {wrong > 0 && (
          <button class="btn primary big" type="button" onClick={onRetryWrong}>
            Falsche nochmal üben ({wrong})
          </button>
        )}
        <button class="btn" type="button" onClick={onRestart}>
          Neues Quiz
        </button>
        <a class="btn" href="#/">
          Zur Deckliste
        </a>
      </div>

      {answers.length > 0 && (
        <ol class="review">
          {answers.map((a, i) => (
            <li key={i} class={a.correct ? 'ok' : 'bad'}>
              <span class="mark" aria-label={a.correct ? 'richtig' : 'falsch'}>
                {a.correct ? '✓' : '✗'}
              </span>
              <div>
                <Rich text={promptOf(a.question)} />
                <p class="muted">
                  Deine Antwort: {a.given}
                  {a.note === 'zeit' && ' (Zeit abgelaufen)'}
                  {a.note === 'tippfehler' && ' (Tippfehler toleriert)'}
                  {a.note === 'gewertet' && ' (selbst als richtig gewertet)'}
                </p>
                {!a.correct && (
                  <p>
                    Richtig: <Rich text={solutionOf(a.question)} inline />
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function promptOf(question: Question): string {
  return question.kind === 'self' ? question.front : question.prompt;
}

function solutionOf(question: Question): string {
  switch (question.kind) {
    case 'choice':
      return question.options[question.correct] ?? '';
    case 'tf':
      return question.answer ? 'Richtig' : 'Falsch';
    case 'typed':
      return question.answer;
    case 'cloze':
      return question.gaps.map((g) => g.answer).join(' · ');
    case 'self':
      return question.back;
  }
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')} min` : `${seconds} s`;
}
