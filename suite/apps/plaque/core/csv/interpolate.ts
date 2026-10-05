import type { GuestRow } from "../data/rows";

/** `{{ Column Name }}` — whitespace inside the braces is ignored. */
const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/g;

/** Every column referenced by a template string, in order, deduplicated. */
export function tokensIn(template: string): string[] {
  const out: string[] = [];
  for (const m of template.matchAll(TOKEN)) {
    const name = m[1] ?? "";
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

export interface Interpolated {
  text: string;
  /** Tokens that named a column this CSV does not have. */
  missing: string[];
}

/** Brackets an empty value takes with it: "Ada ({{Dietary}})" is "Ada", not "Ada ()". */
const PAIRS: Record<string, string> = { "(": ")", "[": "]", "{": "}", "“": "”", "‘": "’", "«": "»", '"': '"' };

/** Punctuation between two values, such as " — ", ", " or "  ·  ": it belongs to the value it introduces. */
function isSeparator(literal: string): boolean {
  return /^[\s\p{P}\p{S}]+$/u.test(literal) && /[\p{P}\p{S}]/u.test(literal);
}

/**
 * Fills a template from a guest row.
 *
 * An unknown token resolves to an empty string rather than being left on the
 * card as literal `{{Nickname}}` — a stray token printed onto a hundred cards is
 * far worse than a gap. The name is returned in `missing` so the UI can say so.
 *
 * An empty value takes what was only there to separate it: the punctuation
 * before it once a value has been said ("Zainab — {{Table}}" is "Zainab"),
 * else the punctuation after it ("{{Last Name}}, Prince" is "Prince"), and brackets
 * round it. Otherwise it takes ONE adjacent space, so "{{First}} {{Last}}" with
 * no surname does not leave a trailing space that shifts centred text off
 * centre. Words are never taken, and whitespace the user typed deliberately,
 * or inside a value, is left exactly as it is — silently rewriting someone's
 * data is not this function's job.
 */
export function interpolate(template: string, row: GuestRow): Interpolated {
  const missing: string[] = [];
  // The template as literal, token, literal, …, literal.
  const literals: string[] = [];
  const tokens: Array<{ name: string; value: string }> = [];
  let cursor = 0;
  for (const match of template.matchAll(TOKEN)) {
    literals.push(template.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    const name = (match[1] ?? "").trim();
    const value = name ? row[name] : "";
    if (value === undefined && !missing.includes(name)) missing.push(name);
    tokens.push({ name, value: value ?? "" });
  }
  literals.push(template.slice(cursor));

  let out = "";
  // Whether a value has been said yet: the punctuation before an empty value is
  // its own only when something came before it to separate it from.
  let seen = false;
  tokens.forEach(({ name, value }, i) => {
    let before = literals[i]!;
    if (value || !name) {
      out += before + value;
      seen ||= Boolean(value);
      return;
    }
    const after = literals[i + 1]!;
    if (PAIRS[before.slice(-1)] !== undefined && after.startsWith(PAIRS[before.slice(-1)]!)) {
      before = before.slice(0, -1);
      literals[i + 1] = after.slice(1);
    }
    if (seen && isSeparator(before)) {
      return;
    }
    if (!seen && i < tokens.length - 1 && isSeparator(literals[i + 1]!)) {
      literals[i + 1] = "";
      out += before;
      return;
    }
    // Absorb one space on whichever side it had one, so the gap closes up.
    out += before;
    if (out.endsWith(" ")) out = out.slice(0, -1);
    else if (literals[i + 1]!.startsWith(" ")) literals[i + 1] = literals[i + 1]!.slice(1);
  });
  return { text: out + literals[tokens.length]!, missing };
}
