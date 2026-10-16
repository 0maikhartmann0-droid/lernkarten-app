import type { CardContent } from '../db/types';
import { parseCloze } from '../modes/cloze';
import { choiceLabel } from '../modes/flashcards';
import { replaceMath } from '../modes/math';

/**
 * Anki-Textdatei: eine Notiz pro Zeile, Vorderseite<TAB>Rückseite<TAB>Tags. Die Kopfzeilen
 * versteht Anki ab Version 2.1.55 – dann ist nichts mehr einzustellen. Felder sind HTML,
 * Formeln werden zu MathJax (\( … \) und \[ … \]), das Anki von sich aus darstellt.
 */
export function toAnkiTsv(cards: readonly CardContent[]): string {
  const header = ['#separator:tab', '#html:true', '#tags column:3'];
  const rows = cards.map((card) => {
    const { front, back } = ankiSides(card);
    const tags = card.tags.map((t) => t.replace(/\s+/g, '_')).join(' ');
    return [toAnkiField(front), toAnkiField(back), tags].join('\t');
  });
  return [...header, ...rows].join('\n') + '\n';
}

/** Vorder- und Rückseite als Markdown-Text, so wie man die Karte auf Papier schreiben würde. */
export function ankiSides(card: CardContent): { front: string; back: string } {
  let front = card.front;
  let back = card.back ?? '';
  switch (card.type) {
    case 'mc': {
      const choices = card.choices ?? [];
      const index = typeof card.answer === 'number' ? card.answer : -1;
      front += '\n\n' + choices.map((c, i) => `${choiceLabel(i)}) ${c}`).join('\n');
      back = `${choiceLabel(index)}) ${choices[index] ?? ''}`;
      break;
    }
    case 'tf':
      front += '\n\n(Richtig oder falsch?)';
      back = card.answer === true ? 'Richtig' : 'Falsch';
      break;
    case 'cloze': {
      const segments = parseCloze(card.front);
      front = segments.map((s) => (s.kind === 'text' ? s.text : `[${s.hint ?? '…'}]`)).join('');
      back = segments.map((s) => (s.kind === 'text' ? s.text : `**${s.answer}**`)).join('');
      break;
    }
    case 'basic':
    case 'typed':
      break;
  }
  if (card.explain) back += `\n\n${card.explain}`;
  if (card.source) back += `\n\nQuelle: ${card.source}`;
  return { front, back };
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Markdown-Text zu einem Anki-Feld: HTML-sicher, fett/kursiv, Zeilenumbrüche, keine Tabs. */
export function toAnkiField(text: string): string {
  const formulas: string[] = [];
  const withoutMath = replaceMath(text, (tex, display) => {
    formulas.push(display ? `\\[${escapeHtml(tex.trim())}\\]` : `\\(${escapeHtml(tex.trim())}\\)`);
    return `⟦M${formulas.length - 1}⟧`;
  });
  return escapeHtml(withoutMath)
    .replace(/\\\$/g, () => '$')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/\t/g, ' ')
    .replace(/\r?\n/g, '<br>')
    .replace(/⟦M(\d+)⟧/g, (_, i: string) => formulas[Number(i)] ?? '');
}
