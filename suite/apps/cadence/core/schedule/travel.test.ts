import { describe, expect, it } from "vitest";
import { emptyDoc } from "../model/defaults";
import type { Block, Journey, TagDetail, TimelineDoc } from "../model/types";
import { blockingConflicts, conflicts } from "./conflicts";
import { resolve } from "./resolve";
import { journeyMinutes, moves, travelPairs, travelShortfalls, withJourney } from "./travel";

function block(id: string, lane: string, at: string, minutes: number, location: string, tags: string[], extra: Partial<Block> = {}): Block {
  const [h, m] = at.split(":").map(Number);
  return {
    id,
    label: id,
    durationMin: minutes,
    anchorMin: h! * 60 + m!,
    gapMin: 0,
    bufferMin: 0,
    lane,
    tags,
    location,
    notes: "",
    outputs: [],
    ...extra,
  };
}

function day(blocks: Block[], travel: Journey[] = [], tagDetails: TagDetail[] = []): TimelineDoc {
  return { ...emptyDoc(), lanes: ["Main day", "Photos", "Suppliers"], blocks, travel, tagDetails };
}

const short = (doc: TimelineDoc) => travelShortfalls(resolve(doc), doc);
const HOUSE_TO_VENUE: Journey[] = [{ between: ["The house", "The venue"], minutes: 15 }];

describe("travel between places", () => {
  it("says when somebody is due somewhere before they could get there", () => {
    // The PRD's own case: hair and make-up ends at 13:00, the first look is
    // at 13:05, and the venue is fifteen minutes away.
    const doc = day(
      [
        block("Hair and make-up", "Main day", "11:00", 120, "The house", ["couple"]),
        block("First look", "Main day", "13:05", 20, "The venue", ["couple"]),
      ],
      HOUSE_TO_VENUE,
    );
    expect(short(doc)).toEqual([
      {
        kind: "no-travel-time",
        severity: "advisory",
        blockIds: ["Hair and make-up", "First look"],
        message:
          "couple finishes Hair and make-up at 13:00 at The house, and is due at First look at 13:05 at The venue, 15 minutes away: 10 minutes short.",
      },
    ]);
  });

  it("measures from where the run sheet says a block ends, not after its buffer", () => {
    // The buffer is for overrunning. Spent on the journey, it is gone.
    const doc = day(
      [
        block("Hair and make-up", "Main day", "11:00", 120, "The house", ["couple"], { bufferMin: 10 }),
        block("First look", "Photos", "13:12", 20, "The venue", ["couple"]),
      ],
      HOUSE_TO_VENUE,
    );
    expect(short(doc).map((found) => found.message)).toEqual([
      "couple finishes Hair and make-up at 13:00 at The house, and is due at First look at 13:12 at The venue, 15 minutes away: 3 minutes short.",
    ]);
  });

  it("says nothing when there is time, or when no time was typed", () => {
    const blocks = [
      block("Hair and make-up", "Main day", "11:00", 120, "The house", ["couple"]),
      block("First look", "Main day", "13:15", 20, "The venue", ["couple"]),
    ];
    expect(short(day(blocks, HOUSE_TO_VENUE))).toEqual([]);
    const tight = [blocks[0]!, { ...blocks[1]!, anchorMin: 13 * 60 + 5 }];
    expect(short(day(tight, []))).toEqual([]);
  });

  it("matches places whatever their case and spacing, and a journey either way round", () => {
    const doc = day(
      [
        block("First look", "Main day", "13:00", 20, "the venue ", ["couple"]),
        block("Back for the dress", "Main day", "13:25", 20, "THE HOUSE", ["couple"]),
      ],
      HOUSE_TO_VENUE,
    );
    expect(journeyMinutes(doc, " the venue", "the house")).toBe(15);
    expect(short(doc)).toHaveLength(1);
  });

  it("carries where somebody was across a block with no location", () => {
    const doc = day(
      [
        block("Hair and make-up", "Main day", "11:00", 120, "The house", ["couple"]),
        block("In the car", "Main day", "13:00", 5, "", ["couple"]),
        block("First look", "Main day", "13:05", 20, "The venue", ["couple"]),
      ],
      HOUSE_TO_VENUE,
    );
    expect(short(doc).map((found) => found.blockIds)).toEqual([["Hair and make-up", "First look"]]);
  });

  it("names everybody making the same move once, by the name they were given", () => {
    const doc = day(
      [
        block("Getting ready", "Main day", "11:00", 120, "The house", ["photographer", "couple"]),
        block("First look", "Main day", "13:05", 20, "The venue", ["photographer", "couple"]),
      ],
      HOUSE_TO_VENUE,
      [{ tag: "photographer", displayName: "Eleanor Vane Photography" }],
    );
    const found = short(doc);
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toMatch(/^Eleanor Vane Photography and couple finish Getting ready at 13:00 .* and are due at First look/);
  });

  it("does not treat a lane as somebody: two suppliers one after the other are not a journey", () => {
    const doc = day(
      [
        block("Florist", "Suppliers", "11:00", 60, "The house", ["florist"]),
        block("Caterer", "Suppliers", "12:05", 60, "The venue", ["caterer"]),
      ],
      HOUSE_TO_VENUE,
    );
    expect(moves(resolve(doc), doc)).toEqual([]);
    expect(short(doc)).toEqual([]);
  });

  it("leaves somebody in two places at once to the double-booking check", () => {
    const doc = day(
      [
        block("Hair and make-up", "Main day", "11:00", 150, "The house", ["couple"]),
        block("First look", "Photos", "13:05", 20, "The venue", ["couple"]),
      ],
      HOUSE_TO_VENUE,
    );
    const found = conflicts(resolve(doc), doc);
    expect(found.map((entry) => entry.kind)).toEqual(["tag-double-booked"]);
  });

  it("is advisory: it is on the screen with the rest, and never holds up a print", () => {
    const doc = day(
      [
        block("Hair and make-up", "Main day", "11:00", 120, "The house", ["couple"]),
        block("First look", "Main day", "13:05", 20, "The venue", ["couple"]),
      ],
      HOUSE_TO_VENUE,
    );
    const found = conflicts(resolve(doc), doc);
    expect(found.map((entry) => entry.kind)).toContain("no-travel-time");
    expect(blockingConflicts(found)).toEqual([]);
  });
});

describe("moves", () => {
  it("lists every change of place, per tag, in time order", () => {
    const doc = day([
      block("Getting ready", "Main day", "08:00", 180, "The suite", ["photographer"]),
      block("Ceremony", "Main day", "13:30", 45, "Orangery", ["photographer", "registrar"]),
      block("Rings", "Main day", "13:15", 0, "Orangery", ["registrar"]),
      block("Confetti", "Main day", "14:15", 15, "Front steps", ["photographer"]),
    ]);
    expect(moves(resolve(doc), doc).map((move) => `${move.tag}: ${move.fromPlace} → ${move.toPlace}`)).toEqual([
      "photographer: The suite → Orangery",
      "photographer: Orangery → Front steps",
    ]);
  });
});

describe("travelPairs", () => {
  const doc = day(
    [
      block("Getting ready", "Main day", "08:00", 180, "The suite", ["photographer", "couple"]),
      block("Ceremony", "Main day", "13:30", 45, "Orangery", ["photographer", "couple"]),
      block("Back to change", "Main day", "15:00", 30, "the suite", ["couple"]),
    ],
    [
      { between: ["Orangery", "The suite"], minutes: 5 },
      { between: ["Church", "The suite"], minutes: 20 },
    ],
    [{ tag: "photographer", displayName: "Eleanor Vane Photography" }],
  );

  it("lists each pair of places once, with its time and everybody who makes the journey", () => {
    expect(travelPairs(resolve(doc), doc).used).toEqual([
      { between: ["The suite", "Orangery"], minutes: 5, who: ["Eleanor Vane Photography", "couple"] },
    ]);
  });

  it("keeps the journeys the day no longer makes apart, to be forgotten", () => {
    expect(travelPairs(resolve(doc), doc).unused).toEqual([{ between: ["Church", "The suite"], minutes: 20 }]);
  });
});

describe("withJourney", () => {
  const travel: Journey[] = [{ between: ["The house", "The venue"], minutes: 15 }];

  it("adds, changes and takes away, matching a pair either way round", () => {
    expect(withJourney([], ["The house", "The venue"], 15)).toEqual(travel);
    expect(withJourney(travel, ["the venue", "the house"], 20)).toEqual([{ between: ["The house", "The venue"], minutes: 20 }]);
    expect(withJourney(travel, ["The venue", "The house"], null)).toEqual([]);
    expect(withJourney(travel, ["The venue", "The house"], 0)).toEqual([]);
  });

  it("hands back the same list when nothing changes", () => {
    expect(withJourney(travel, ["The house", "The venue"], 15)).toBe(travel);
    expect(withJourney(travel, ["Church", "The venue"], null)).toBe(travel);
  });
});
