import { QUIZ_MODES, type QuizMode } from '../modes/quiz';

export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  newPerDay: number;
  reviewsPerDay: number;
  theme: Theme;
  /** Zuletzt gewählte Quiz-Einstellungen */
  quizMode: QuizMode;
  /** 0 = alle passenden Karten */
  quizCount: number;
  /** Sekunden pro Frage, 0 = ohne Zeitlimit */
  quizSeconds: number;
  typoTolerance: boolean;
  /** Große Bedienelemente, Bildschirm bleibt beim Lernen an */
  trainMode: boolean;
  /** Zeitpunkt des letzten Backups (ms), 0 = noch nie */
  lastBackup: number;
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 20,
  reviewsPerDay: 100,
  theme: 'auto',
  quizMode: 'gemischt',
  quizCount: 10,
  quizSeconds: 0,
  typoTolerance: true,
  trainMode: false,
  lastBackup: 0,
};

// Der Schlüssel wird auch vom Inline-Skript in index.html gelesen.
const STORAGE_KEY = 'lernkarten-settings';

export function loadSettings(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>;
    return {
      newPerDay: limit(stored.newPerDay, DEFAULT_SETTINGS.newPerDay),
      reviewsPerDay: limit(stored.reviewsPerDay, DEFAULT_SETTINGS.reviewsPerDay),
      theme: stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : 'auto',
      quizMode: QUIZ_MODES.some((m) => m.mode === stored.quizMode)
        ? (stored.quizMode as QuizMode)
        : DEFAULT_SETTINGS.quizMode,
      quizCount: limit(stored.quizCount, DEFAULT_SETTINGS.quizCount),
      quizSeconds: limit(stored.quizSeconds, DEFAULT_SETTINGS.quizSeconds),
      typoTolerance: stored.typoTolerance !== false,
      trainMode: stored.trainMode === true,
      lastBackup: typeof stored.lastBackup === 'number' ? stored.lastBackup : 0,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Privater Modus o. Ä.: Die Einstellungen gelten dann nur bis zum Schließen.
  }
  applyAppearance(settings);
}

/** Übernimmt Einstellungen aus einem Backup; ungültige Werte fallen auf die Standardwerte zurück. */
export function restoreSettings(raw: unknown): void {
  if (typeof raw !== 'object' || raw === null) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  } catch {
    return;
  }
  saveSettings(loadSettings());
}

export function applyAppearance(settings: Pick<Settings, 'theme' | 'trainMode'>): void {
  const root = document.documentElement;
  if (settings.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  root.classList.toggle('train', settings.trainMode);
}

function limit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(9999, Math.floor(value))
    : fallback;
}
