import { describe, expect, it } from 'vitest';
import type { CardContent } from '../db/types';
import { toAnkiTsv } from '../export/ankiTsv';
import { fromAnkiHtml, parseTabular, splitRows } from './tabular';

const OPTIONS = { title: 'Holzbau Begriffe', subject: 'Holzbau', today: new Date(2026, 9, 16) };

function cardsOf(text: string, options = OPTIONS): CardContent[] {
  const result = parseTabular(text, options);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value.cards;
}

describe('Import aus Quizlet', () => {
  it('liest Begriff<Tab>Definition, eine Karte pro Zeile', () => {
    const result = parseTabular('BSH\tBrettschichtholz\nKVH\tKonstruktionsvollholz\n', OPTIONS);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.value.deck).toMatchObject({
      id: 'holzbau-begriffe',
      title: 'Holzbau Begriffe',
      subject: 'Holzbau',
      created: '2026-10-16',
    });
    expect(result.value.cards.map((c) => [c.type, c.front, c.back])).toEqual([
      ['basic', 'BSH', 'Brettschichtholz'],
      ['basic', 'KVH', 'Konstruktionsvollholz'],
    ]);
    expect(result.value.warnings).toEqual([]);
  });

  it('vergibt stabile IDs, damit ein erneuter Import aktualisiert', () => {
    const first = cardsOf('BSH\tBrettschichtholz');
    const second = cardsOf('BSH\tBrettschichtholz (verklebt)');
    expect(second[0]!.id).toBe(first[0]!.id);
  });

  it('akzeptiert Semikolon als Trennzeichen und Windows-Zeilenenden', () => {
    expect(cardsOf('BSH;Brettschichtholz\r\nKVH;Konstruktionsvollholz\r\n')).toHaveLength(2);
  });

  it('nimmt die dritte Spalte als Tags', () => {
    expect(cardsOf('BSH\tBrettschichtholz\tholzwerkstoffe bauholz')[0]!.tags).toEqual([
      'holzwerkstoffe',
      'bauholz',
    ]);
  });

  it('nennt Zeilen ohne Trennzeichen oder ohne Definition', () => {
    const result = parseTabular('BSH\tBrettschichtholz\nNur ein Begriff\n\nKVH\t\n', OPTIONS);
    expect(result).toEqual({
      ok: false,
      errors: [
        'Zeile 2: Kein Trennzeichen – erwartet „Begriff<Tab>Definition“.',
        'Zeile 4: Rückseite (Definition) ist leer.',
      ],
    });
  });

  it('überspringt doppelte Zeilen mit Hinweis', () => {
    const result = parseTabular('BSH\tA\nBSH\tA\nBSH\tB', OPTIONS);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.value.cards).toHaveLength(2);
    expect(result.value.warnings).toEqual(['1 doppelte Zeile(n) übersprungen.']);
  });

  it('meldet leeren Text und fehlendes Trennzeichen', () => {
    expect(parseTabular('  \n', OPTIONS).ok).toBe(false);
    const result = parseTabular('eins\nzwei', OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('Kein Trennzeichen gefunden');
  });
});

describe('Import aus Anki', () => {
  it('beachtet Kopfzeilen, Anführungszeichen-Felder, HTML und Spalten für Typ, Deck und GUID', () => {
    const text = [
      '#separator:tab',
      '#html:true',
      '#guid column:1',
      '#notetype column:2',
      '#deck column:3',
      '#tags column:6',
      'aB3x\tBasic\tHolzbau\t<b>Stabdübel</b>\t"Glatter Stift<br>aus Stahl, ""ohne"" Kopf"\tverbindungen',
      'Qz9y\tCloze\tHolzbau\tDer U-Wert ist \\(1/R_T\\) = {{c1::Kehrwert}}\tExtra-Info\t',
    ].join('\n');
    const cards = cardsOf(text);
    expect(cards[0]).toMatchObject({
      id: 'aB3x',
      type: 'basic',
      front: '**Stabdübel**',
      back: 'Glatter Stift\naus Stahl, "ohne" Kopf',
      tags: ['verbindungen'],
    });
    expect(cards[1]).toMatchObject({
      id: 'Qz9y',
      type: 'cloze',
      front: 'Der U-Wert ist $1/R_T$ = {{c1::Kehrwert}}',
      explain: 'Extra-Info',
    });
  });

  it('liest den eigenen Anki-Export wieder ein', () => {
    const exported = toAnkiTsv([
      {
        id: 'a',
        type: 'basic',
        front: 'R?',
        back: '$R = \\frac{d}{\\lambda}$\nin m²K/W',
        tags: ['waerme'],
      },
    ]);
    expect(cardsOf(exported)[0]).toMatchObject({
      front: 'R?',
      back: '$R = \\frac{d}{\\lambda}$\nin m²K/W',
      tags: ['waerme'],
    });
  });

  it('wandelt Entities, Absätze und Bilder', () => {
    expect(fromAnkiHtml('<div>A&nbsp;&amp;&#x42;</div><div>C &lt;3</div>')).toEqual({
      text: 'A &B\nC <3',
    });
    expect(fromAnkiHtml('Skizze <img src="stoss.png"> [$]x^2[/$]')).toEqual({
      text: 'Skizze  $x^2$',
      image: 'stoss.png',
    });
  });

  it('zerlegt mehrzeilige Felder in Anführungszeichen mit richtiger Zeilennummer', () => {
    expect(splitRows('a\t"b\nc"\nd\te', '\t')).toEqual([
      { line: 1, fields: ['a', 'b\nc'] },
      { line: 3, fields: ['d', 'e'] },
    ]);
  });
});
