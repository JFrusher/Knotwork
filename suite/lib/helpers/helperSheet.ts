import type { z } from "zod";
import type { helperSheetSchema } from "./schemas";
import type { Knotwork } from "@jfrusher/knotwork";
import { formatClock } from "@/lib/minutes";
import { longDate } from "@/lib/dates";
import { runningOrder } from "@/lib/binder/binder";
import { resolveMembers } from "@/lib/cast/resolve";
import { neededAt, whereBy } from "@/lib/boxes/view";
import { dayPlaces, readBoxes, readCast, readCrew, readGuests, readSeating, readShots } from "@/lib/model/slices";
import { hiddenToolIds } from "@/lib/model/toolbox";

/**
 * One day-of helper's sheet: what their link shows. The run of the day, their
 * jobs and their team's, the boxes, the group shots with the names in each,
 * and the crew's numbers.
 *
 * Built field by field from what a helper needs, never by copying a slice, so
 * nothing new on a guest or a job can arrive here by accident. Never in it:
 * anyone's dietary needs, a guest's email, the guest list, the seating plan,
 * money, notes, or anything from the Checklist.
 */
export type HelperSheet = z.infer<typeof helperSheetSchema>;

const span = (startMin: number, endMin: number) => `${formatClock(startMin)}–${formatClock(endMin)}`;

export function helperSheet(doc: Knotwork, personId: string): HelperSheet | null {
  const crew = readCrew(doc);
  const person = crew.people.find((entry) => entry.id === personId);
  if (!person) return null;
  const teamName = new Map(crew.teams.map((team) => [team.id, team.name]));
  const personName = new Map(crew.people.map((entry) => [entry.id, entry.name]));
  const hidden = hiddenToolIds(doc);
  const day = runningOrder(doc);
  const blocks = new Map(day.map((block) => [block.id, block]));

  const mine = crew.jobs.filter(
    (job) => job.personIds.includes(personId) || (person.teamId !== null && job.teamId === person.teamId),
  );
  const who = (job: (typeof mine)[number]) => [
    ...(job.teamId ? [teamName.get(job.teamId) ?? ""] : []),
    ...job.personIds.map((id) => personName.get(id) ?? ""),
  ].filter(Boolean);
  const onTheDay = mine
    .filter((job) => job.blockId !== null && blocks.has(job.blockId))
    .sort((a, b) => blocks.get(a.blockId!)!.startMin - blocks.get(b.blockId!)!.startMin)
    .map((job) => {
      const block = blocks.get(job.blockId!)!;
      return { label: job.label, when: span(block.startMin, block.endMin), where: block.location, who: who(job) };
    });
  const before = mine
    .filter((job) => job.blockId === null)
    .map((job) => ({ label: job.label, when: job.dueOn ? `By ${longDate(job.dueOn)}` : "Before the day", where: "", who: who(job) }));

  const places = dayPlaces(doc);
  const boxes = hidden.has("boxes")
    ? []
    : readBoxes(doc).boxes.map((box) => {
        const { place, lost } = neededAt(box, places);
        return {
          number: box.number,
          name: box.name,
          where: whereBy(place, lost),
          items: box.items.map((item) => (item.quantity > 1 ? `${item.label} × ${item.quantity}` : item.label)),
          takenBy: box.personIds.map((id) => personName.get(id) ?? "").filter(Boolean),
        };
      });

  const guests = readGuests(doc);
  const seating = readSeating(doc);
  const cast = readCast(doc);
  const shots = hidden.has("group-shots")
    ? []
    : readShots(doc).sections.map((section) => ({
        section: section.name,
        shots: section.shots.map((shot) => {
          const resolved = resolveMembers(shot, guests, seating, cast.roles, cast.customRoles, doc.event);
          return { label: resolved.label, names: resolved.people.map((p) => p.name) };
        }),
      }));

  // The crew's own numbers, typed into Delegation for the day. A crew person
  // who is also a guest is reached by the number typed here, never through
  // their guest entry. One entry per number, the first name it is known by.
  const seen = new Set<string>();
  const numbers = [
    ...crew.teams.map((team) => ({ name: team.name, role: team.tag ?? "Supplier", phone: team.phone })),
    ...crew.people.map((entry) => ({ name: entry.name, role: (entry.teamId && teamName.get(entry.teamId)) || "Crew", phone: entry.phone })),
  ].filter((contact) => {
    const digits = contact.phone.replace(/\D/g, "");
    if (digits === "" || seen.has(digits)) return false;
    seen.add(digits);
    return true;
  });

  return {
    wedding: { names: doc.event.coupleNames, date: doc.event.date, venue: doc.event.venueName },
    helper: { name: person.name, team: (person.teamId && teamName.get(person.teamId)) || "" },
    day: day.map((block) => ({ label: block.label, when: span(block.startMin, block.endMin), where: block.location })),
    jobs: [...onTheDay, ...before],
    boxes,
    shots,
    crew: numbers,
  };
}
