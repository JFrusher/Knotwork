// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { fingerprint } from "@/lib/documents/fingerprint";
import { calendar, calendarFile } from "@/apps/timeline/render/ics/calendar";
import { readTimeline } from "@/lib/model/slices";
import { callSheet } from "./callSheet";

type Raw = Record<string, any>;
const raw: Raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
const doc = migrate(raw);
const team = (tag: string) => (raw.crew.teams as Array<{ id: string; tag: string }>).find((entry) => entry.tag === tag)!.id;

describe("a supplier's call sheet", () => {
  it("has their arrival, their people and their jobs, and nothing of anyone else's", () => {
    const sheet = callSheet(doc, team("photographer"))!;
    expect(sheet).toEqual({
      wedding: { names: "Alex & Sam", date: "2028-06-01", venue: "The Old Granary" },
      supplier: "Eleanor Vane Photography",
      arrival: "07:45",
      people: ["Maya Ivers"],
      jobs: [{ label: "Photograph the ceremony", when: "13:30–14:15", where: "Orangery", during: "Ceremony" }],
      before: [],
      calendar: {
        couple: "Alex & Sam",
        tagLabel: "Eleanor Vane Photography",
        events: [
          { id: "blk-prep", label: "Getting ready", location: "The suite", startMin: 480, endMin: 660 },
          { id: "blk-ceremony", label: "Ceremony", location: "Orangery", startMin: 810, endMin: 855 },
          { id: "blk-confetti", label: "Confetti", location: "Front steps", startMin: 855, endMin: 870 },
          { id: "blk-groups", label: "Group photographs", location: "Lawn", startMin: 945, endMin: 975 },
          { id: "blk-portraits", label: "Couple portraits", location: "Walled garden", startMin: 975, endMin: 1005 },
          { id: "blk-cake", label: "Cake cutting", location: "Great hall", startMin: 1190, endMin: 1200 },
        ],
      },
    });
    // No guest travels on it. Whole names: a surname alone can be a trading
    // name too — "Eleanor Vane Photography" is not the Vane family.
    const text = JSON.stringify(sheet);
    const guests = Object.values(raw.guests as Record<string, { firstName: string; lastName: string }>).map(
      (guest) => `${guest.firstName} ${guest.lastName}`,
    );
    expect(guests.filter((name) => text.includes(name))).toEqual([]);
  });

  it("changes when their jobs do, and not when a guest's details do", () => {
    const seen = (changed: Raw) => fingerprint(callSheet(migrate(changed), team("photographer")));
    const theirs = (raw.crew.jobs as Array<{ id: string; teamId: string | null }>).find(
      (job) => job.teamId === team("photographer"),
    )!;
    const relabelled = {
      ...raw,
      crew: {
        ...raw.crew,
        jobs: (raw.crew.jobs as Raw[]).map((job) => (job.id === theirs.id ? { ...job, label: "Photograph the vows" } : job)),
      },
    };
    const guestId = Object.keys(raw.guests)[0]!;
    const guestChanged = { ...raw, guests: { ...raw.guests, [guestId]: { ...raw.guests[guestId], dietary: "No nuts" } } };

    expect(seen(relabelled)).not.toBe(seen(raw));
    expect(seen(guestChanged)).toBe(seen(raw));
  });

  it("makes the same calendar file the Timeline downloads for that supplier", () => {
    const now = new Date("2028-05-01T09:00:00Z");
    const sheet = callSheet(doc, team("registrar"))!;
    const fromTimeline = calendar(readTimeline(doc), { date: "2028-06-01", tag: "registrar", now });
    expect(calendarFile(sheet.calendar, sheet.wedding.date, now)).toBe(fromTimeline);
    expect(fromTimeline).toContain("SUMMARY:Ceremony");
    // Block notes can say anything, so they go to nobody's calendar.
    expect(fromTimeline).not.toContain("DESCRIPTION:");
  });

  it("is nothing for a supplier the wedding does not have", () => {
    expect(callSheet(doc, "no-such-team")).toBeNull();
  });
});
