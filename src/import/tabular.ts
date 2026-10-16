import { slug } from '../db/slug';
import { hasCloze } from '../modes/cloze';
import { isoDate } from '../srs/day';
import { SCHEMA_ID, stableId, validateDeck, type ValidationResult } from './validation';

// Import von Textdateien aus Anki ("Notizen als Klartext") und Quizlet (Exportieren:
// Begriff<TAB>Definition, eine Karte pro Zeile). Ergebnis ist ein normales Deck im Format v1.

export interface TabularOptions {
  title: string;
  subject?: string;
  source?: string;
  today?: Date;
}

const SEPARATORS: Record<string, string> = {
  tab: '\t',
  comma: ',',
  semicolon: ';',
  pipe: '|',
  colon: ':',
  space: ' ',
};

interface Header {
  separator?: string;
  html?: boolean;
  /** 1-basierte Spalten mit Zusatzinfos, die nicht zum Karteninhalt gehören */
  tags?: number;
  guid?: number;
  meta: Set<number>;
}

function readHeader(lines: string[]): { header: Header; bodyStart: number } {
  const header: Header = { meta: new Set() };
  let i = 0;
  for (; i < lines.length; i++) {
    const match = /^#([a-z ]+):(.*)$/i.exec(lines[i]!.trim());
    if (!match) break;
    const key = match[1]!.trim().toLowerCase();
    const value = match[2]!.trim();
    if (key === 'separator') {
      header.separator =
        SEPARATORS[value.toLowerCase()] ?? (value.length === 1 ? value : undefined);
    } else if (key === 'html') {
      header.html = value.toLowerCase() === 'true';
    } else if (key.endsWith(' column')) {
      const column = Number(value);
      if (!Number.isInteger(column) || column < 1) continue;
      if (key === 'tags column') header.tags = column;
      else if (key === 'guid column') header.guid = column;
      header.meta.add(column);
    }
  }
  return { header, bodyStart: i };
}

function detectSeparator(lines: string[]): string | undefined {
  const sample = lines.filter((l) => l.trim() !== '').slice(0, 50);
  if (sample.some((l) => l.includes('\t'))) return '\t';
  const share = (sep: string) =>
    sample.filter((l) => l.includes(sep)).length / (sample.length || 1);
  if (share(';') >= 0.5) return ';';
  if (share(',') >= 0.8) return ',';
  return undefined;
}

interface Row {
  line: number;
  fields: string[];
}

/** Zerlegt in Zeilen und Felder; Felder in "…" dürfen Trennzeichen und Zeilenumbrüche enthalten. */
export function splitRows(text: string, separator: string, firstLine = 1): Row[] {
  const rows: Row[] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let atFieldStart = true;
  let line = firstLine;
  let rowLine = firstLine;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && atFieldStart) {
      quoted = true;
      atFieldStart = false;
    } else if (ch === separator) {
      fields.push(field);
      field = '';
      atFieldStart = true;
    } else if (ch === '\n') {
      fields.push(field);
      rows.push({ line: rowLine, fields });
      fields = [];
      field = '';
      atFieldStart = true;
      line++;
      rowLine = line;
    } else {
      field += ch;
      atFieldStart = false;
    }
  }
  if (field !== '' || fields.length > 0) {
    fields.push(field);
    rows.push({ line: rowLine, fields });
  }
  return rows;
}

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** Anki-HTML zu Markdown-Text: Umbrüche, fett/kursiv, Entities, MathJax → $…$, Bild → Pfad. */
export function fromAnkiHtml(html: string): { text: string; image?: string } {
  let image: string | undefined;
  const text = html
    .replace(/<img[^>]*src=["']?([^"' >]+)["']?[^>]*>/gi, (_, src: string) => {
      image ??= src;
      return '';
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li)>/gi, '\n')
    .replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(i|em)>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X'))
        return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
      return ENTITIES[code.toLowerCase()] ?? entity;
    })
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex: string) => `$$${tex}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex: string) => `$${tex}$`)
    .replace(/\[\$\$\]([\s\S]+?)\[\/\$\$\]/g, (_, tex: string) => `$$${tex}$$`)
    .replace(/\[\$\]([\s\S]+?)\[\/\$\]/g, (_, tex: string) => `$${tex}$`)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return image ? { text, image } : { text };
}

const looksLikeHtml = (text: string) => /<[a-z/][^>]*>|&(#?[a-z0-9]+);/i.test(text);

export function parseTabular(text: string, options: TabularOptions): ValidationResult {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.replace(/\r\n?/g, '\n').split('\n');
  const { header, bodyStart } = readHeader(lines);
  const body = lines.slice(bodyStart);
  const separator = header.separator ?? detectSeparator(body);
  if (body.every((l) => l.trim() === '')) {
    return { ok: false, errors: ['Keine Karten gefunden. Erwartet: eine Karte pro Zeile.'] };
  }
  if (!separator) {
    return {
      ok: false,
      errors: [
        'Kein Trennzeichen gefunden. Erwartet: eine Karte pro Zeile, Begriff und Definition durch Tab (oder Semikolon) getrennt.',
      ],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const cards: Record<string, unknown>[] = [];
  const ids = new Set<string>();
  const pairs = new Set<string>();
  let duplicates = 0;
  // Ohne Anki-Kopfzeilen gilt das Format der Anforderungen: Vorderseite, Rückseite, Tags.
  const tagsColumn = header.tags ?? (header.meta.size === 0 ? 3 : undefined);

  for (const row of splitRows(body.join('\n'), separator, bodyStart + 1)) {
    if (row.fields.every((f) => f.trim() === '')) continue;
    const content = row.fields.filter((_, i) => !header.meta.has(i + 1) && i + 1 !== tagsColumn);
    const html = header.html ?? content.some(looksLikeHtml);
    const convert = (field = '') => (html ? fromAnkiHtml(field) : { text: field.trim() });
    const front = convert(content[0]);
    const back = convert(content[1]);
    if (content.length < 2 && !hasCloze(front.text)) {
      errors.push(
        `Zeile ${row.line}: Kein Trennzeichen – erwartet „Begriff${separator === '\t' ? '<Tab>' : separator}Definition“.`,
      );
      continue;
    }

    const cloze = hasCloze(front.text);
    if (!front.text) {
      errors.push(`Zeile ${row.line}: Vorderseite (Begriff) ist leer.`);
      continue;
    }
    if (!cloze && !back.text) {
      errors.push(`Zeile ${row.line}: Rückseite (Definition) ist leer.`);
      continue;
    }

    const pair = `${front.text}\u0000${back.text}`;
    if (pairs.has(pair)) {
      duplicates++;
      continue;
    }
    pairs.add(pair);

    // Gleicher Begriff mit anderer Definition ist eine eigene Karte (z. B. zwei Bedeutungen).
    const guid = header.guid ? row.fields[header.guid - 1]?.trim() : undefined;
    let id = guid || stableId(front.text);
    if (!guid && ids.has(id)) id = stableId(`${front.text}|${back.text}`);
    if (ids.has(id)) {
      duplicates++;
      continue;
    }
    ids.add(id);

    const card: Record<string, unknown> = {
      id,
      type: cloze ? 'cloze' : 'basic',
      front: front.text,
    };
    if (cloze) {
      if (back.text) card.explain = back.text;
    } else {
      card.back = back.text;
    }
    const tags = tagsColumn ? row.fields[tagsColumn - 1] : undefined;
    if (tags) card.tags = tags.split(/\s+/).filter(Boolean);
    const image = front.image ?? back.image;
    if (image) card.image = image;
    cards.push(card);
  }

  if (errors.length > 0) return { ok: false, errors };
  if (duplicates > 0) warnings.push(`${duplicates} doppelte Zeile(n) übersprungen.`);

  const result = validateDeck(
    {
      schema: SCHEMA_ID,
      deck: {
        id: slug(options.title),
        title: options.title.trim(),
        subject: options.subject?.trim() ?? '',
        created: isoDate(options.today),
        source: options.source ?? 'Import aus einer Textdatei (Anki/Quizlet)',
      },
      cards,
    },
    options.today,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    value: { ...result.value, warnings: [...result.value.warnings, ...warnings] },
  };
}
