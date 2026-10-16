import { describe, expect, it } from 'vitest';
import { checkTyped, levenshtein, normalizeAnswer } from './typed';

describe('normalizeAnswer', () => {
  it('ignoriert Groß-/Kleinschreibung, Leerzeichen und einen Schlusspunkt', () => {
    expect(normalizeAnswer('  U-Wert . ')).toBe('u-wert');
    expect(normalizeAnswer('Bewertetes  Schalldämm-Maß')).toBe('bewertetesschalldaemm-mass');
  });

  it('entfernt Markdown-Auszeichnung', () => {
    expect(normalizeAnswer('**dB**')).toBe('db');
  });
});

describe('levenshtein', () => {
  it('zählt Einfügen, Löschen und Ersetzen', () => {
    expect(levenshtein('wert', 'wert')).toBe(0);
    expect(levenshtein('wert', 'wer')).toBe(1);
    expect(levenshtein('wert', 'wort')).toBe(1);
    expect(levenshtein('wert', 'werte')).toBe(1);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('checkTyped', () => {
  it('erkennt die exakte Antwort trotz anderer Schreibweise', () => {
    expect(checkTyped('db', 'dB')).toBe('richtig');
    expect(checkTyped('u-wert', 'U-Wert')).toBe('richtig');
    expect(checkTyped('Taupunkt temperatur', 'Taupunkttemperatur')).toBe('richtig');
  });

  it('akzeptiert Umlaute als ae/oe/ue und ß als ss', () => {
    expect(checkTyped('Waermeleitfaehigkeit', 'Wärmeleitfähigkeit')).toBe('richtig');
    expect(checkTyped('Schallmass', 'Schallmaß')).toBe('richtig');
  });

  it('toleriert einen Tippfehler bei längeren Antworten', () => {
    expect(checkTyped('Tauponkt', 'Taupunkt')).toBe('tippfehler');
    expect(checkTyped('U Wert', 'U-Wert')).toBe('tippfehler');
  });

  it('toleriert keine Tippfehler bei kurzen Antworten', () => {
    expect(checkTyped('dA', 'dB')).toBe('falsch');
    expect(checkTyped('Pa', 'Pas')).toBe('falsch');
  });

  it('lässt sich ohne Tippfehler-Toleranz streng prüfen', () => {
    expect(checkTyped('Tauponkt', 'Taupunkt', false)).toBe('falsch');
  });

  it('wertet zwei Fehler und leere Eingaben als falsch', () => {
    expect(checkTyped('Taupinkd', 'Taupunkt')).toBe('falsch');
    expect(checkTyped('   ', 'Taupunkt')).toBe('falsch');
  });
});
