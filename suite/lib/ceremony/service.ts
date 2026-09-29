import type { CeremonyKind, Moment } from "@/lib/model/types";
import { newMoment } from "./moments";

/**
 * A starting order of service for each kind of ceremony, as they usually run
 * in England and Wales. A start, not a rule: every moment's title, length and
 * place is the couple's to change, and their officiant has the last word.
 *
 * A civil ceremony follows the registrar's legal words — the declaratory
 * words, then the contracting words — and ends with the register signed. A
 * religious one is shaped like a Church of England service; other faiths'
 * run differently and start from here all the same. A humanist ceremony has
 * no register in England and Wales, where the legal part is done separately.
 */
export function suggestService(kind: CeremonyKind): Moment[] {
  const opening = [newMoment("music"), newMoment("processional")];
  switch (kind) {
    case "civil":
      return [
        ...opening,
        newMoment("welcome", { title: "The registrar's welcome" }),
        newMoment("reading"),
        newMoment("declaration", { title: "The declaratory words" }),
        newMoment("vows", { title: "The contracting words" }),
        newMoment("rings"),
        newMoment("words", { title: "The pronouncement", minutes: 1 }),
        newMoment("kiss"),
        newMoment("signing"),
        newMoment("recessional"),
      ];
    case "religious":
      return [
        ...opening,
        newMoment("welcome"),
        newMoment("song", { title: "A hymn" }),
        newMoment("reading"),
        newMoment("words", { title: "The address" }),
        newMoment("declaration", { title: "The declarations" }),
        newMoment("vows"),
        newMoment("rings"),
        newMoment("words", { title: "The proclamation", minutes: 1 }),
        newMoment("words", { title: "Prayers", minutes: 3 }),
        newMoment("song", { title: "A hymn" }),
        newMoment("signing"),
        newMoment("recessional"),
      ];
    case "humanist":
      return [
        ...opening,
        newMoment("welcome"),
        newMoment("words", { title: "Your story" }),
        newMoment("reading"),
        newMoment("vows"),
        newMoment("rings"),
        newMoment("declaration"),
        newMoment("kiss"),
        newMoment("recessional"),
      ];
    case "other":
      return [...opening, newMoment("welcome"), newMoment("vows"), newMoment("rings"), newMoment("declaration"), newMoment("kiss"), newMoment("recessional")];
  }
}

/** What each kind of ceremony is called on the page. */
export const CEREMONY_KIND_NAMES: Record<CeremonyKind, string> = {
  civil: "Civil, with a registrar",
  religious: "Religious",
  humanist: "Humanist or celebrant-led",
  other: "Something else",
};
