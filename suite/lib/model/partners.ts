import type { Event as WeddingEvent } from "@jfrusher/knotwork";
import type { CastRole, Side } from "./types";

/** Each partner's name as the guests know it, or who they are while it is unset. */
export function partnerNames(event: Pick<WeddingEvent, "partners">): [string, string] {
  const [a, b] = event.partners ?? ["", ""];
  return [a.trim() || "Partner one", b.trim() || "Partner two"];
}

/** The title every page and print carries: "Alex & Sam", or one name alone. */
export function coupleTitle(partners: readonly [string, string]): string {
  return partners
    .map((name) => name.trim())
    .filter(Boolean)
    .join(" & ");
}

/** "Alex’s", and "James’" for a name that ends in s. */
export const possessive = (name: string) => (name.endsWith("s") ? `${name}’` : `${name}’s`);

/** "Alex’s side", "Both sides", or nothing for a guest nobody has placed. */
export function sideLabel(side: Side, event: Pick<WeddingEvent, "partners">): string {
  const [a, b] = partnerNames(event);
  if (side === "a") return `${possessive(a)} side`;
  if (side === "b") return `${possessive(b)} side`;
  if (side === "both") return "Both sides";
  return "";
}

/** The short form, for a filter chip or a column heading: "Alex’s". */
export function sideShort(side: Exclude<Side, "">, event: Pick<WeddingEvent, "partners">): string {
  const [a, b] = partnerNames(event);
  if (side === "a") return possessive(a);
  if (side === "b") return possessive(b);
  return "Both";
}

/** A role in words: "Alex", "Sam’s mother", "Sam’s grandparents", "Alex’s wedding party". */
export function roleLabel(role: CastRole, event: Pick<WeddingEvent, "partners">): string {
  const [a, b] = partnerNames(event);
  const name = role.startsWith("a") ? a : b;
  if (role === "a" || role === "b") return name;
  if (role.endsWith("-mother")) return `${possessive(name)} mother`;
  if (role.endsWith("-father")) return `${possessive(name)} father`;
  if (role.endsWith("-grandparents")) return `${possessive(name)} grandparents`;
  return `${possessive(name)} wedding party`;
}

/**
 * The two names out of a title written before partners were stored separately
 * — "Charis & Jacob", "Alex and Sam". Anything else is not guessed at: "The
 * Smiths" names nobody in particular.
 */
export function splitTitle(title: string): [string, string] | null {
  const parts = title.split(/\s+(?:&|and|\+)\s+/i).map((part) => part.trim());
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : null;
}
