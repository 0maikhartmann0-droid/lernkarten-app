import { useState } from 'preact/hooks';
import { recordQuizAnswer, type QuizScope } from '../db/repo';
import { buildQuiz, reshuffle, shuffle, type Question, type QuizMode } from '../modes/quiz';
import { QuizResult } from './QuizResult';
import { QuizRunner, type QuizAnswer } from './QuizRunner';
import { QuizSetup } from './QuizSetup';

export interface QuizConfig {
  scope: QuizScope;
  mode: QuizMode;
  seconds: number;
  typoTolerance: boolean;
}

type Phase =
  | { name: 'setup' }
  | { name: 'running'; config: QuizConfig; questions: Question[]; startedAt: number }
  | { name: 'result'; config: QuizConfig; answers: QuizAnswer[]; duration: number };

/** Einrichten → Fragen beantworten → Auswertung. deckId wählt das Deck in der Einrichtung vor. */
export function Quiz({ deckId }: { deckId?: string }) {
  const [phase, setPhase] = useState<Phase>({ name: 'setup' });

  const start = (config: QuizConfig, questions: Question[]) => {
    window.scrollTo(0, 0);
    setPhase({ name: 'running', config, questions, startedAt: Date.now() });
  };

  if (phase.name === 'setup') {
    return (
      <QuizSetup
        initialScope={deckId ? { kind: 'deck', deckId } : undefined}
        onStart={(config, cards, count) =>
          start(config, buildQuiz(cards, config.mode, count || cards.length, Math.random))
        }
      />
    );
  }

  if (phase.name === 'running') {
    return (
      <QuizRunner
        key={phase.startedAt}
        questions={phase.questions}
        seconds={phase.config.seconds}
        typoTolerance={phase.config.typoTolerance}
        record={recordQuizAnswer}
        onFinish={(answers) => {
          window.scrollTo(0, 0);
          setPhase({
            name: 'result',
            config: phase.config,
            answers,
            duration: Date.now() - phase.startedAt,
          });
        }}
      />
    );
  }

  // Gleiche Fragen in neuer Reihenfolge; bei Multiple Choice auch die Antworten neu gemischt.
  const retryWrong = () => {
    const wrong = phase.answers.filter((a) => !a.correct).map((a) => a.question);
    start(
      phase.config,
      shuffle(wrong, Math.random).map((q) => reshuffle(q, Math.random)),
    );
  };

  return (
    <QuizResult
      answers={phase.answers}
      duration={phase.duration}
      onRetryWrong={retryWrong}
      onRestart={() => setPhase({ name: 'setup' })}
    />
  );
}
