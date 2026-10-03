import { newId } from "@/lib/model/ids";
import type { Event as WeddingEvent } from "@jfrusher/knotwork";
import { partnerNames, possessive } from "@/lib/model/partners";
import type { CastRole, Guest, Seating, ShotSection } from "@/lib/model/types";

/**
 * Starting points for the shot list. `generate` is `template` plus one shot
 * per family and named group, so there is exactly one place that builds the
 * classic sections. Takes the *current* sections and merges into them —
 * matched and reused by name, each shot added only if no shot with that exact
 * label already exists in its section — so pressing either button twice adds
 * nothing the second time.
 */

interface ClassicShot {
  label: string;
  roles: CastRole[];
}
interface ClassicSection {
  name: string;
  shots: ClassicShot[];
}

/**
 * The classic list, in the partners' own names. It said "the bride with her
 * parents" and "the groom with his groomsmen"; it now says "Alex with their
 * parents", and the roles behind each shot are "whichever partner", so a list
 * seeded once follows a corrected spelling everywhere but its own labels.
 */
function classic(event: Pick<WeddingEvent, "partners">): ClassicSection[] {
  const [a, b] = partnerNames(event);
  const family = (name: string, who: "a" | "b"): ClassicSection => ({
    name: `${possessive(name)} family`,
    shots: [
      { label: `The couple with ${possessive(name)} parents`, roles: ["a", "b", `${who}-mother`, `${who}-father`] },
      { label: `${name} with their parents`, roles: [who, `${who}-mother`, `${who}-father`] },
      { label: `${name} with their mother`, roles: [who, `${who}-mother`] },
      { label: `${name} with their father`, roles: [who, `${who}-father`] },
    ],
  });
  return [
    { name: "The couple", shots: [{ label: "The couple, alone", roles: ["a", "b"] }] },
    family(a, "a"),
    family(b, "b"),
    {
      name: "Both families",
      shots: [
        {
          label: "The couple with all four parents",
          roles: ["a", "b", "a-mother", "a-father", "b-mother", "b-father"],
        },
      ],
    },
    {
      name: "Wedding party",
      shots: [
        { label: "The full wedding party", roles: ["a", "b", "a-party", "b-party"] },
        { label: `${a} with their wedding party`, roles: ["a", "a-party"] },
        { label: `${b} with their wedding party`, roles: ["b", "b-party"] },
      ],
    },
  ];
}

function sectionFor(side: "a" | "b" | "both", event: Pick<WeddingEvent, "partners">): string {
  const [a, b] = partnerNames(event);
  if (side === "a") return `${possessive(a)} family`;
  if (side === "b") return `${possessive(b)} family`;
  return "Both families";
}

function sectionNamed(sections: ShotSection[], name: string): ShotSection {
  const found = sections.find((s) => s.name === name);
  if (found) return found;
  const created: ShotSection = { id: newId("sec"), name, shots: [] };
  sections.push(created);
  return created;
}

function sideOf(guestIds: string[], guests: Record<string, Guest>): "a" | "b" | "both" | null {
  let a = 0;
  let b = 0;
  for (const id of guestIds) {
    const side = guests[id]?.side;
    if (side === "a") a += 1;
    else if (side === "b") b += 1;
  }
  if (a === 0 && b === 0) return null;
  if (a === b) return "both";
  return a > b ? "a" : "b";
}

function appendFamiliesAndGroups(
  sections: ShotSection[],
  guests: Record<string, Guest>,
  seating: Seating,
  event: Pick<WeddingEvent, "partners">,
): void {
  for (const family of Object.values(seating.families)) {
    const section = sectionNamed(sections, sectionFor(sideOf(family.memberIds, guests) ?? "both", event));
    if (section.shots.some((s) => s.label === family.name)) continue;
    section.shots.push({ id: newId("shot"), label: family.name, members: [{ kind: "family", ref: family.id }], notes: "" });
  }

  const namedGroups = { ...seating.groups, ...seating.subgroups };
  for (const group of Object.values(namedGroups)) {
    const memberIds = Object.values(guests)
      .filter((g) => g.groupId === group.id || g.subgroupId === group.id)
      .map((g) => g.id);
    const section = sectionNamed(sections, sectionFor(sideOf(memberIds, guests) ?? "both", event));
    if (section.shots.some((s) => s.label === group.name)) continue;
    section.shots.push({ id: newId("shot"), label: group.name, members: [{ kind: "group", ref: group.id }], notes: "" });
  }
}

export function propose(
  existing: ShotSection[],
  guests: Record<string, Guest>,
  seating: Seating,
  mode: "template" | "generate",
  event: Pick<WeddingEvent, "partners">,
): ShotSection[] {
  const sections = existing.map((s) => ({ ...s, shots: [...s.shots] }));

  for (const seed of classic(event)) {
    const section = sectionNamed(sections, seed.name);
    for (const shot of seed.shots) {
      if (section.shots.some((s) => s.label === shot.label)) continue;
      section.shots.push({
        id: newId("shot"),
        label: shot.label,
        members: shot.roles.map((role) => ({ kind: "role" as const, ref: role })),
        notes: "",
      });
    }
  }

  if (mode === "generate") appendFamiliesAndGroups(sections, guests, seating, event);

  return sections;
}
