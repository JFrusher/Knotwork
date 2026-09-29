import type { Event as WeddingEvent } from "@jfrusher/trousseau";
import { resolveMembers } from "@/lib/cast/resolve";
import { coupleTitle, sideLabel } from "@/lib/model/partners";
import type { CastSlice, Formation, Guest, Seating, WalkGroup } from "@/lib/model/types";

export const FORMATION_WORDS: Record<Formation, string> = {
  single: "One at a time",
  pairs: "In pairs",
  threes: "In threes",
};

/** One group as it is read out or printed: the page and the email are made from these, so they agree. */
export interface ProcessionalRow {
  number: number;
  label: string;
  /** The people walking, by name; empty for a group of words alone. */
  people: string[];
  /** "In pairs, to Alex’s side". */
  how: string;
  music: string;
  cue: string;
  trouble: boolean;
}

export function processionalRows(
  processional: WalkGroup[],
  guests: Record<string, Guest>,
  seating: Seating,
  cast: CastSlice,
  event: Pick<WeddingEvent, "partners">,
): ProcessionalRow[] {
  return processional.map((group, index) => {
    const resolved = resolveMembers(group, guests, seating, cast.roles, cast.customRoles, event);
    const side = sideLabel(group.side, event);
    const people = resolved.people.map((person) => person.name);
    return {
      number: index + 1,
      label: resolved.label,
      // Words standing in for somebody — "The officiant" — are the label already.
      people: people.join(", ") === resolved.label ? [] : people,
      // "to Alex’s side", "to both sides": a name keeps its capital.
      how: side ? `${FORMATION_WORDS[group.formation]}, to ${group.side === "both" ? "both sides" : side}` : FORMATION_WORDS[group.formation],
      music: group.music.trim(),
      cue: group.cue.trim(),
      trouble: resolved.problems.length > 0,
    };
  });
}

/** The processional as plain text, to paste into an email to the wedding party. */
export function processionalText(rows: ProcessionalRow[], event: Pick<WeddingEvent, "partners">): string {
  const title = coupleTitle(event.partners);
  const lines = [title ? `The processional — ${title}` : "The processional", ""];
  for (const row of rows) {
    lines.push(`${row.number}. ${row.label}`);
    if (row.people.length > 0) lines.push(`   ${row.people.join(", ")}`);
    lines.push(`   ${row.how}.`);
    const music = [row.music && `Music: ${row.music}.`, row.cue && `${row.cue}.`].filter(Boolean).join(" ");
    if (music) lines.push(`   ${music}`);
  }
  return lines.join("\n");
}
