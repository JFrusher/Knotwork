import { describe, expect, it } from "vitest";
import { emptyKnotwork, migrate } from "@jfrusher/knotwork";
import { coerceGuests, personName, PROCESSIONAL_MOMENT_ID, readBoxes, readCast, readCeremony, readCrew, readShots, readTimeline } from "./slices";

describe("coerceGuests keeps what it has no opinion about", () => {
  it("preserves fields owned by a tool rather than by the suite", () => {
    // Tableaux stores fullName, dietaryRaw and assignedSeatId on a guest; the
    // suite's model has never heard of them. Rebuilding a guest from the
    // suite's own field list dropped all three, and reconcileLoadedDocument
    // writes the result back on load — so seat positions inside a table were
    // silently destroyed by opening the app.
    const guests = coerceGuests({
      g1: {
        id: "g1",
        firstName: "Alexander",
        lastName: "Okonkwo",
        fullName: "Alexander Okonkwo",
        dietaryRaw: "no shellfish please",
        assignedTableId: "t1",
        assignedSeatId: "t1:3",
      },
    });

    expect(guests["g1"]).toMatchObject({
      fullName: "Alexander Okonkwo",
      dietaryRaw: "no shellfish please",
      assignedSeatId: "t1:3",
    });
  });

  it("still normalises the fields it does own", () => {
    const guests = coerceGuests({ g1: { id: "g1", rsvpStatus: "nonsense", tags: "not a list" } });
    expect(guests["g1"]).toMatchObject({ rsvpStatus: "pending", tags: [] });
  });

  it("carries a key belonging to a tool that does not exist yet", () => {
    const guests = coerceGuests({ g1: { id: "g1", favouriteColour: "sage" } });
    expect(guests["g1"]).toMatchObject({ favouriteColour: "sage" });
  });
});

describe("readCrew", () => {
  const docWith = (crew: unknown) => ({ ...emptyKnotwork(), crew } as never);

  it("reads a team's contract fields", () => {
    const crew = readCrew(
      docWith({
        teams: [
          {
            id: "t1",
            name: "Bloom & Co",
            cost: 1450,
            deposit: 300,
            depositPaidOn: "2026-11-02",
            balanceDueOn: "2027-05-01",
            email: "hello@bloom.example",
            confirmedOn: "2026-11-03",
          },
        ],
      }),
    );

    expect(crew.teams[0]).toMatchObject({
      cost: 1450,
      deposit: 300,
      depositPaidOn: "2026-11-02",
      balanceDueOn: "2027-05-01",
      email: "hello@bloom.example",
      confirmedOn: "2026-11-03",
    });
  });

  it("leaves a team with no contract details alone", () => {
    const crew = readCrew(docWith({ teams: [{ id: "t1", name: "Ushers" }] }));
    expect(crew.teams[0]).toMatchObject({
      cost: null,
      deposit: null,
      depositPaidOn: "",
      confirmedOn: "",
    });
  });

  it("keeps a field belonging to a tool it has never heard of", () => {
    // The same rule as the envelope, one level down. readCrew rebuilt every
    // team from a fixed list, which is how coerceGuests destroyed fullName.
    const crew = readCrew(docWith({ teams: [{ id: "t1", name: "Band", vanRegistration: "AB12 CDE" }] }));
    expect(crew.teams[0]).toMatchObject({ vanRegistration: "AB12 CDE" });
  });

  it("reads the budget, and treats a missing one as unset", () => {
    expect(readCrew(docWith({ budget: 18000 })).budget).toBe(18000);
    expect(readCrew(docWith({})).budget).toBeNull();
  });

  it("accepts a job that is not tied to a block", () => {
    const crew = readCrew(docWith({ jobs: [{ id: "j1", label: "Order confetti", blockId: null }] }));
    expect(crew.jobs[0]!.blockId).toBeNull();
  });

  it("still reads a job that is tied to one", () => {
    const crew = readCrew(docWith({ jobs: [{ id: "j1", label: "Buttonholes", blockId: "b1" }] }));
    expect(crew.jobs[0]!.blockId).toBe("b1");
  });
});

describe("readTimeline's travel", () => {
  it("keeps a journey with two places and a time, and drops one missing either", () => {
    const doc = migrate({
      timeline: {
        travel: [
          { between: ["The house", "The venue"], minutes: 15 },
          { between: ["The house", ""], minutes: 10 },
          { between: ["The house"], minutes: 10 },
          { between: ["Church", "The venue"], minutes: 0 },
          { between: ["Church", "The venue"], minutes: "20" },
          "Church to the venue",
        ],
      },
    });
    expect(readTimeline(doc).travel).toEqual([{ between: ["The house", "The venue"], minutes: 15 }]);
  });

  it("is empty on a wedding that has never typed one", () => {
    expect(readTimeline(emptyKnotwork()).travel).toEqual([]);
  });
});

describe("readCast", () => {
  it("reads who is who from its own slice", () => {
    const cast = readCast(migrate({ cast: { roles: { "b-grandparents": ["g1", "g2"] }, customRoles: [{ id: "c1", name: "Readers", guestIds: [] }] } }));
    expect(cast.roles["b-grandparents"]).toEqual(["g1", "g2"]);
    expect(cast.roles.a).toEqual([]);
    expect(cast.customRoles).toEqual([{ id: "c1", name: "Readers", guestIds: [] }]);
  });

  it("reads a document written before the cast had a slice, old role names and all", () => {
    // The server reads stored documents nobody has opened since, so these
    // must not read as having no cast.
    const doc = migrate({ shots: { cast: { bride: ["g1"] }, customRoles: [{ id: "c1", name: "Readers", guestIds: [] }], sections: [] } });
    expect(readCast(doc).roles.a).toEqual(["g1"]);
    expect(readCast(doc).customRoles).toHaveLength(1);
    expect(readShots(doc)).toEqual({ sections: [] });
  });

  it("is empty on a wedding with no cast anywhere", () => {
    expect(readCast(emptyKnotwork()).customRoles).toEqual([]);
    expect(Object.values(readCast(emptyKnotwork()).roles).every((ids) => ids.length === 0)).toBe(true);
  });
});

describe("readCeremony", () => {
  it("reads a processional, filling in what a group does not say, and converting old role names", () => {
    const doc = migrate({
      ceremony: {
        processional: [
          { id: "w1", members: [{ kind: "role", ref: "bride" }], formation: "threes", side: "b", music: "Canon in D" },
          { id: "w2", formation: "sideways", side: "left" },
          { label: "No id, so not a group" },
        ],
      },
    });
    const canon = { title: "Canon in D", artist: "", arrangement: "", playedBy: "", startSec: null, endSec: null, lyrics: "" };
    expect(readCeremony(doc).processional).toEqual([
      { id: "w1", label: "", members: [{ kind: "role", ref: "a" }], formation: "threes", side: "b", song: canon, cue: "" },
      { id: "w2", label: "", members: [], formation: "single", side: "", song: null, cue: "" },
    ]);
  });

  it("reads a ceremony stored before the order of service with one holding its processional, the same every time", () => {
    const doc = migrate({ ceremony: { processional: [{ id: "w1" }] } });
    const { order, kind, witnesses } = readCeremony(doc);
    expect(order).toHaveLength(1);
    expect(order[0]).toMatchObject({ id: PROCESSIONAL_MOMENT_ID, kind: "processional", title: "The processional" });
    expect(readCeremony(migrate({ ceremony: { processional: [{ id: "w1" }] } })).order[0]!.id).toBe(PROCESSIONAL_MOMENT_ID);
    expect({ kind, witnesses }).toEqual({ kind: "civil", witnesses: [] });
    // Once an order is stored, even an empty one, it is the couple's.
    expect(readCeremony(migrate({ ceremony: { processional: [{ id: "w1" }], order: [] } })).order).toEqual([]);
  });

  it("reads each moment's song and times, refusing what a track time cannot be", () => {
    const doc = migrate({
      ceremony: {
        kind: "humanist",
        order: [{ id: "m1", kind: "reading", minutes: 3, print: true, song: { title: "Air", startSec: 45, endSec: -2 } }, { id: "m2", kind: "juggling" }],
      },
    });
    const [reading, other] = readCeremony(doc).order;
    expect(reading).toMatchObject({ kind: "reading", minutes: 3, printWords: true, printLyrics: true, approved: false, song: { title: "Air", startSec: 45, endSec: null } });
    expect(other).toMatchObject({ kind: "other", minutes: null, song: null });
    expect(readCeremony(doc).kind).toBe("humanist");
  });
});

describe("readBoxes", () => {
  it("reads boxes, filling in what a box does not say, and never a quantity below one", () => {
    const doc = migrate({
      boxes: { boxes: [{ id: "b1", name: "Getting ready", items: [{ id: "i1", label: "Shoes", quantity: 0 }, { label: "No id" }], blockId: 7 }, { name: "No id" }] },
    });
    expect(readBoxes(doc).boxes).toEqual([
      { id: "b1", number: 1, name: "Getting ready", items: [{ id: "i1", label: "Shoes", quantity: 1, packed: false }], blockId: null, personIds: [], notes: "" },
    ]);
  });
});

describe("personName", () => {
  const guests = { g1: { ...coerceGuests({ g1: { id: "g1", firstName: "Ines", lastName: "Ashdown" } })["g1"]! } };
  it("names somebody who is a guest as the guest list does, and anyone else as the crew does", () => {
    expect(personName({ name: "Old spelling", guestId: "g1" }, guests)).toBe("Ines Ashdown");
    expect(personName({ name: "Rosa Wilde", guestId: null }, guests)).toBe("Rosa Wilde");
    expect(personName({ name: "Kept", guestId: "g-deleted" }, guests)).toBe("Kept");
  });
});
