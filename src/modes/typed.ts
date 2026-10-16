// Freitext-Antworten tolerant vergleichen: Groß-/Kleinschreibung, Leerzeichen, Umlaut-Umschreibung
// und auf Wunsch ein einzelner Tippfehler zählen nicht als falsch.

export type TypedVerdict = 'richtig' | 'tippfehler' | 'falsch';

/** Ab dieser Länge der Lösung wird ein Tippfehler toleriert – bei "dB" wäre jeder Fehler ein anderes Wort. */
const MIN_LENGTH_FOR_TYPO = 4;

export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    .replace(/[*_`]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, '')
    .replace(/[.!]+$/, '');
}

export function levenshtein(a: string, b: string): number {
  const s = Array.from(a);
  const t = Array.from(b);
  let previous = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const current = [i];
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[t.length]!;
}

export function checkTyped(input: string, expected: string, allowTypo = true): TypedVerdict {
  const given = normalizeAnswer(input);
  const target = normalizeAnswer(expected);
  if (given === '') return 'falsch';
  if (given === target) return 'richtig';
  if (
    allowTypo &&
    Array.from(target).length >= MIN_LENGTH_FOR_TYPO &&
    levenshtein(given, target) <= 1
  ) {
    return 'tippfehler';
  }
  return 'falsch';
}
