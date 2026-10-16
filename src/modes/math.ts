// "$$…$$" als abgesetzte Formel, "$…$" im Fließtext. Ein Betrag wie "5 $" bleibt Text,
// weil nach dem öffnenden Zeichen kein Leerzeichen stehen darf.
const BLOCK_MATH = /\$\$([\s\S]+?)\$\$/g;
const INLINE_MATH = /(?<!\\)\$(?!\s)((?:\\.|[^$\\\n])+?)(?<!\s)\$(?!\d)/g;

/** Ersetzt jede Formel im Text; display = abgesetzte Formel ($$…$$). */
export function replaceMath(
  text: string,
  replace: (tex: string, display: boolean) => string,
): string {
  return text
    .replace(BLOCK_MATH, (_, tex: string) => replace(tex, true))
    .replace(INLINE_MATH, (_, tex: string) => replace(tex, false));
}
