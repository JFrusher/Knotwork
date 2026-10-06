import { newId } from "@/lib/model/ids";
import type { Moment, MomentKind } from "@/lib/model/types";

/** A moment of a kind, with its usual title and length: the one way a moment is made. */
export function newMoment(kind: MomentKind, patch: Partial<Omit<Moment, "id" | "kind">> = {}): Moment {
  return {
    id: newId("moment"),
    kind,
    title: MOMENT_TITLES[kind],
    members: [],
    minutes: MOMENT_MINUTES[kind],
    cue: "",
    song: null,
    words: "",
    print: false,
    approved: false,
    notes: "",
    ...patch,
  };
}

/** What each kind of moment is called until the couple says otherwise. */
const MOMENT_TITLES: Record<MomentKind, string> = {
  music: "Music as guests arrive",
  processional: "The processional",
  welcome: "Welcome",
  reading: "A reading",
  song: "A song",
  words: "Words",
  vows: "The vows",
  rings: "The rings",
  declaration: "The declaration",
  kiss: "The kiss",
  signing: "Signing the register",
  recessional: "The recessional",
  other: "",
};

/**
 * How long each kind of moment usually takes, in minutes, as a start: every
 * one is changed on the page. Music as guests arrive is before the ceremony
 * starts, so it has none, and does not count towards its length.
 */
const MOMENT_MINUTES: Record<MomentKind, number | null> = {
  music: null,
  processional: 3,
  welcome: 3,
  reading: 3,
  song: 4,
  words: 5,
  vows: 3,
  rings: 2,
  declaration: 1,
  kiss: 1,
  signing: 10,
  recessional: 3,
  other: 2,
};

/** What each kind of moment is called when choosing one. */
export const MOMENT_KIND_NAMES: Record<MomentKind, string> = {
  music: "Music",
  processional: "The processional",
  welcome: "Welcome",
  reading: "A reading",
  song: "A song or hymn",
  words: "Words — an address, a story, prayers",
  vows: "Vows",
  rings: "Rings",
  declaration: "Declaration",
  kiss: "The kiss",
  signing: "Signing the register",
  recessional: "The recessional",
  other: "Something else",
};
