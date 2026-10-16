import DOMPurify from 'dompurify';
import katex from 'katex';
import { marked } from 'marked';
import { replaceMath } from '../modes/math';

const PLACEHOLDER = /⟦M(\d+)⟧/g;

/**
 * Markdown + LaTeX zu sicherem HTML. Kartentexte stammen aus importierten Dateien.
 * inline: ohne Absätze, z. B. für Antwortmöglichkeiten in einem Button.
 */
export function renderRich(text: string, inline = false): string {
  const formulas: string[] = [];
  const stash = (tex: string, displayMode: boolean) => {
    formulas.push(katex.renderToString(tex.trim(), { displayMode, throwOnError: false }));
    return `⟦M${formulas.length - 1}⟧`;
  };

  // Formeln vor dem Markdown-Lauf herausnehmen, damit "_" und "*" darin nicht als Auszeichnung gelten.
  const withoutMath = replaceMath(text, stash).replace(/\\\$/g, () => '$');

  const options = { async: false, gfm: true, breaks: true } as const;
  const html = inline
    ? marked.parseInline(withoutMath, options)
    : marked.parse(withoutMath, options);
  return DOMPurify.sanitize(html).replace(PLACEHOLDER, (_, i: string) => formulas[Number(i)] ?? '');
}
