// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { dayPlaces, readBoxes, readCast, readCeremony, readCrew, readGuests, readSeating, readShots, readTimeline } from "@/lib/model/slices";
import { neededAt, packingOf } from "@/lib/boxes/view";
import { readiness } from "@/lib/model/readiness";
import { resolveMembers } from "@/lib/cast/resolve";
import { computeWarnings } from "@/apps/seating/utils/warnings";
import { shownTools } from "@/lib/model/toolbox";
import { TOOLS } from "@/lib/tools";
import { USUAL_TASKS } from "@/lib/checklist/checklist";

/*
 * The example wedding exists to show what Knotwork does once a wedding is
 * under way, so every chapter of the tour must have something real in it to
 * point at: people in seats, a crew with jobs on the day, a shot list with
 * its people, a card design drawn from the room.
 */
const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
const doc = migrate(raw);
const guests = Object.values(readGuests(doc));
const seating = readSeating(doc);
const coming = guests.filter((g) => g.rsvpStatus !== "declined");

test("the couple are named, and guests have sides, replies, families and groups", () => {
  expect(doc.event.partners).toEqual(["Alex", "Sam"]);
  expect(new Set(guests.map((g) => g.side))).toEqual(new Set(["a", "b", "both"]));
  expect(guests.some((g) => g.rsvpStatus === "declined")).toBe(true);
  expect(guests.some((g) => g.rsvpStatus === "pending")).toBe(true);
  expect(Object.keys(seating.families).length).toBeGreaterThanOrEqual(5);
  expect(Object.keys(seating.groups).length).toBeGreaterThanOrEqual(2);
});

test("nearly everyone coming has a seat — a few do not, which is what there is left to do", () => {
  const unseated = coming.filter((g) => g.assignedTableId === null);
  expect(unseated.length).toBeGreaterThan(0);
  expect(unseated.length).toBeLessThanOrEqual(5);
  expect(guests.filter((g) => g.rsvpStatus === "declined" && g.assignedTableId !== null)).toEqual([]);
  // Guest and table agree on every seat.
  for (const guest of coming.filter((g) => g.assignedTableId)) {
    expect(seating.tables[guest.assignedTableId!]!.assignedGuestIds).toContain(guest.id);
  }
});

test("Seating finds nothing wrong: families sit together, and each group lists its own", () => {
  // As Seating reads them: every guest with the name it shows.
  const named = Object.fromEntries(
    Object.entries(readGuests(doc)).map(([id, g]) => [id, { ...g, fullName: `${g.firstName} ${g.lastName}` }]),
  );
  const warnings = computeWarnings({ guests: named, tables: seating.tables, families: seating.families, constraints: [], settings: seating.settings });
  expect(warnings.filter((w: { level: string }) => w.level === "warn")).toEqual([]);
  // Seating shows a group from its member list, the rest of the suite from the guest.
  const groups = raw.seating.groups as Record<string, { memberIds: string[] }>;
  for (const [id, group] of Object.entries(groups)) {
    expect(group.memberIds.sort()).toEqual(guests.filter((g) => g.groupId === id).map((g) => g.id).sort());
  }
});

test("no two round tables are close enough for their chairs to collide", () => {
  const rounds = Object.values(seating.tables).filter((t) => t.type === "round");
  for (const a of rounds) {
    for (const b of rounds) {
      if (a === b) continue;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(200);
    }
  }
});

test("there is a crew, with jobs hanging off the day", () => {
  const crew = readCrew(doc);
  const blocks = new Set(readTimeline(doc).blocks.map((b) => b.id));
  expect(crew.teams.length).toBeGreaterThanOrEqual(4);
  expect(crew.people.length).toBeGreaterThanOrEqual(5);
  expect(crew.jobs.length).toBeGreaterThanOrEqual(8);
  for (const job of crew.jobs.filter((j) => j.blockId)) expect(blocks.has(job.blockId!)).toBe(true);
  expect(new Set(crew.jobs.map((j) => j.status))).toEqual(new Set(["todo", "doing", "done"]));
});

test("the shot list names real people, with nobody missing from it", () => {
  const shots = readShots(doc);
  const cast = readCast(doc);
  const all = shots.sections.flatMap((s) => s.shots);
  expect(all.length).toBeGreaterThanOrEqual(12);
  for (const shot of all) {
    const resolved = resolveMembers(shot, readGuests(doc), seating, cast.roles, cast.customRoles, doc.event);
    expect(resolved.problems.filter((p) => p.kind !== "declined"), resolved.label).toEqual([]);
  }
});

test("the place cards are drawn from the room, and agree with it", () => {
  const [placeCards] = raw.stationery.pieces as Array<Record<string, unknown>>;
  expect(raw.stationery.version).toBe(3);
  // Nothing copied: every card is read from the room as it stands.
  expect(placeCards).not.toHaveProperty("rows");
  expect(readiness(doc, raw).filter((r) => r.severity === "blocking")).toEqual([]);
});

test("every tool is shown, including those a new wedding adds itself, so there is nothing it cannot demonstrate", () => {
  expect(shownTools(doc)).toEqual(TOOLS);
});

test("the processional names real people, from the same cast as the group shots", () => {
  const processional = readCeremony(doc).processional;
  expect(processional.length).toBeGreaterThanOrEqual(5);
  const cast = readCast(doc);
  for (const group of processional) {
    const resolved = resolveMembers(group, readGuests(doc), seating, cast.roles, cast.customRoles, doc.event);
    expect(resolved.problems.filter((p) => p.kind !== "declined"), resolved.label).toEqual([]);
  }
});

test("the boxes are each needed somewhere on the day, taken by somebody in the crew, and partly packed", () => {
  const { boxes } = readBoxes(doc);
  expect(boxes.length).toBeGreaterThanOrEqual(4);
  const known = dayPlaces(doc);
  const crew = new Set(readCrew(doc).people.map((person) => person.id));
  for (const box of boxes) {
    expect(neededAt(box, known).lost, box.name).toBe(false);
    for (const id of box.personIds) expect(crew.has(id), `${box.name}: ${id}`).toBe(true);
  }
  const { packed, total } = packingOf({ boxes });
  expect(packed).toBeGreaterThan(0);
  expect(packed).toBeLessThan(total);
});

test("every usual task is already on the example's checklist, so it has nothing to offer and shows a finished list", () => {
  const have = new Set(readCrew(doc).jobs.filter((job) => job.blockId === null).map((job) => job.label.toLowerCase()));
  expect(USUAL_TASKS.filter((task) => !have.has(task.label.toLowerCase())).map((task) => task.label)).toEqual([]);
});
