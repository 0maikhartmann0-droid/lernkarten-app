import { useEffect, useState } from 'preact/hooks';

/**
 * Hält den Bildschirm an, solange active wahr ist (Screen Wake Lock API, wo verfügbar).
 * Der Browser gibt die Sperre beim Wechsel in den Hintergrund frei; sie wird beim Zurückkehren
 * neu angefordert. Gibt zurück, ob die Sperre gerade besteht.
 */
export function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      if (stopped || sentinel || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (stopped) {
          void lock.release();
          return;
        }
        sentinel = lock;
        setHeld(true);
        lock.addEventListener('release', () => {
          sentinel = null;
          setHeld(false);
        });
      } catch {
        // Z. B. Energiesparmodus oder fehlende Berechtigung – dann geht der Bildschirm normal aus.
        setHeld(false);
      }
    };

    const onVisibility = () => void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release();
      setHeld(false);
    };
  }, [active]);

  return held;
}
