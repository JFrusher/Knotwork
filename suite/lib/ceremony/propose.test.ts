import { describe, expect, it } from "vitest";
import { setCastRole } from "@/lib/cast/actions";
import { emptyCastSlice } from "@/lib/model/slices";
import { suggestOrder } from "./propose";

const shape = (cast: ReturnType<typeof emptyCastSlice>) =>
  suggestOrder(cast).map((group) => ({
    who: group.members.map((member) => member.ref).join(" + "),
    formation: group.formation,
    side: group.side,
  }));

describe("suggesting an order", () => {
  it("walks from the outside in: the officiant, grandparents, parents, the wedding parties, then the couple together", () => {
    let cast = emptyCastSlice();
    for (const role of ["a-grandparents", "b-mother", "b-father", "a-mother", "a-party", "b-party"] as const) {
      cast = setCastRole(cast, role, ["someone"]);
    }
    expect(shape(cast)).toEqual([
      { who: "The officiant", formation: "single", side: "" },
      { who: "a-grandparents", formation: "pairs", side: "a" },
      { who: "a-mother", formation: "pairs", side: "a" },
      { who: "b-mother + b-father", formation: "pairs", side: "b" },
      { who: "a-party", formation: "pairs", side: "a" },
      { who: "b-party", formation: "pairs", side: "b" },
      { who: "a + b", formation: "pairs", side: "" },
    ]);
  });

  it("leaves out roles nobody is cast in, but never the couple", () => {
    expect(shape(emptyCastSlice()).map((group) => group.who)).toEqual(["The officiant", "a + b"]);
  });

  it("gives every group an id of its own", () => {
    const ids = suggestOrder(emptyCastSlice()).map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
