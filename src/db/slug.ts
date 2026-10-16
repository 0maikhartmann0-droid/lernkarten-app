/** Lesbarer Kurzname für IDs und Dateinamen: "Holzbau – Verbindungen" → "holzbau-verbindungen". */
export function slug(text: string, fallback = 'deck'): string {
  return (
    text
      .toLocaleLowerCase('de-DE')
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || fallback
  );
}
