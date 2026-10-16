import { useEffect, useState } from 'preact/hooks';
import { loadSettings, saveSettings } from './settings';
import { useWakeLock } from './useWakeLock';

const EVENT = 'lernkarten-zugmodus';

/** Zugmodus-Schalter, der überall in der App denselben Stand zeigt. */
export function useTrainMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => loadSettings().trainMode);
  useEffect(() => {
    const sync = () => setOn(loadSettings().trainMode);
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const set = (value: boolean) => {
    saveSettings({ ...loadSettings(), trainMode: value });
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, set];
}

/** Kompakter Schalter für die Kopfzeile beim Lernen und im Quiz; hält im Zugmodus den Bildschirm an. */
export function TrainToggle() {
  const [on, setOn] = useTrainMode();
  const awake = useWakeLock(on);
  return (
    <button
      class={`icon-btn ${on ? 'on' : ''}`}
      type="button"
      aria-pressed={on}
      aria-label="Zugmodus"
      title={
        on
          ? `Zugmodus an${awake ? ' – Bildschirm bleibt an' : ''}`
          : 'Zugmodus: große Buttons, Bildschirm bleibt an'
      }
      onClick={() => setOn(!on)}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <rect
          x="5"
          y="3"
          width="14"
          height="14"
          rx="3"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        />
        <path d="M5 10h14" stroke="currentColor" stroke-width="2" />
        <circle cx="9" cy="13.5" r="1.2" fill="currentColor" />
        <circle cx="15" cy="13.5" r="1.2" fill="currentColor" />
        <path
          d="M8 21l2-4M16 21l-2-4"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </button>
  );
}
