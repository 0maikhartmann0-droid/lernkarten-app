import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

/** Ergebnis einer Dexie-Abfrage, das sich bei Änderungen an den gelesenen Tabellen selbst aktualisiert. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (result) => setValue(() => result),
      error: (error) => console.error(error),
    });
    return () => subscription.unsubscribe();
    // Der Aufrufer bestimmt über deps, wann die Abfrage neu aufgesetzt wird.
  }, deps);
  return value;
}
