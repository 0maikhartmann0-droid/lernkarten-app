// Lückentext im Anki-Format: {{c1::Antwort}} oder {{c1::Antwort::Hinweis}}.

export type ClozeSegment =
  { kind: 'text'; text: string } | { kind: 'cloze'; index: number; answer: string; hint?: string };

const OPEN = /\{\{c(\d+)::/y;

export function parseCloze(input: string): ClozeSegment[] {
  const segments: ClozeSegment[] = [];
  let text = '';
  let i = 0;
  while (i < input.length) {
    OPEN.lastIndex = i;
    const open = OPEN.exec(input);
    const end = open ? findClose(input, i + open[0].length) : -1;
    if (open && end !== -1) {
      if (text) segments.push({ kind: 'text', text });
      text = '';
      const [answer, hint] = splitHint(input.slice(i + open[0].length, end));
      const segment: ClozeSegment = { kind: 'cloze', index: Number(open[1]), answer };
      if (hint) segment.hint = hint;
      segments.push(segment);
      i = end + 2;
    } else {
      text += input[i];
      i++;
    }
  }
  if (text) segments.push({ kind: 'text', text });
  return segments;
}

// Geschweifte Klammern in der Antwort (LaTeX wie \frac{1}{R_T}) dürfen die Lücke nicht vorzeitig schließen.
function findClose(s: string, from: number): number {
  let depth = 0;
  for (let i = from; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      if (depth > 0) depth--;
      else if (s[i + 1] === '}') return i;
    }
  }
  return -1;
}

function splitHint(content: string): [string, string | undefined] {
  let depth = 0;
  for (let i = 0; i < content.length - 1; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') depth = Math.max(0, depth - 1);
    else if (depth === 0 && content[i] === ':' && content[i + 1] === ':') {
      return [content.slice(0, i).trim(), content.slice(i + 2).trim() || undefined];
    }
  }
  return [content.trim(), undefined];
}

export function hasCloze(input: string): boolean {
  return parseCloze(input).some((s) => s.kind === 'cloze' && s.answer !== '');
}

/** Vorderseite: alle Lücken verdeckt. */
export function clozeFront(input: string): string {
  return parseCloze(input)
    .map((s) => (s.kind === 'text' ? s.text : `<mark class="cloze gap">[${s.hint ?? '…'}]</mark>`))
    .join('');
}

/** Rückseite: Lücken ausgefüllt und hervorgehoben. */
export function clozeBack(input: string): string {
  return parseCloze(input)
    .map((s) => (s.kind === 'text' ? s.text : `<mark class="cloze">${s.answer}</mark>`))
    .join('');
}
