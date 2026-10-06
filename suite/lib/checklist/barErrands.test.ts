import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { withTool } from "@/lib/model/toolbox";
import { readCrew } from "@/lib/model/slices";
import { barErrands, withErrandDone } from "./barErrands";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
const doc = migrate(raw);

describe("the Bar's errands on the Checklist", () => {
  it("are one per shop, and the ice, dated back from the day", () => {
    // The example's day is 1 June 2028.
    expect(barErrands(doc).map(({ id, dueOn }) => [id, dueOn])).toEqual([
      ["bar:wine-merchant", "2028-05-18"],
      ["bar:cash-and-carry", "2028-05-25"],
      ["bar:supermarket", "2028-05-30"],
      ["bar:ice", "2028-05-31"],
    ]);
    expect(barErrands(doc)[0]!.label).toBe("Buy the Fizz, White wine and Red wine from the wine merchant");
  });

  it("go when the Bar is hidden", () => {
    const hidden = { ...raw, tools: withTool(raw, "bar", false) };
    expect(barErrands(migrate(hidden))).toEqual([]);
  });

  it("go when the Bar has nothing to buy", () => {
    const lines = Object.fromEntries(["fizz", "white", "red", "beer", "spirits", "mixers", "soft", "ice"].map((line) => [line, { have: 100000 }]));
    const stocked = { ...raw, bar: { ...raw.bar, lines } };
    expect(barErrands(migrate(stocked))).toEqual([]);
  });

  it("are undated while the wedding has no date", () => {
    const undated = { ...raw, event: { ...raw.event, date: "" } };
    expect(barErrands(migrate(undated)).every((errand) => errand.dueOn === "")).toBe(true);
  });

  it("keep a tick by id, which survives the list changing and goes with the errand", () => {
    const crew = withErrandDone(readCrew(doc), "bar:ice", true, barErrands(doc));
    const ticked = migrate({ ...raw, crew });
    expect(barErrands(ticked).find((e) => e.id === "bar:ice")!.done).toBe(true);
    expect(barErrands(ticked).find((e) => e.id === "bar:supermarket")!.done).toBe(false);

    // More guests change what is bought, not the tick.
    const more = migrate({ ...raw, crew, bar: { ...raw.bar, people: 300 } });
    expect(barErrands(more).find((e) => e.id === "bar:ice")!.done).toBe(true);

    // Ticking anything else drops the ticks of errands that are no longer there.
    const hidden = migrate({ ...raw, crew, tools: withTool(raw, "bar", false) });
    expect(withErrandDone(readCrew(hidden), "bar:wine-merchant", true, barErrands(hidden)).errandsDone).toEqual([]);
  });
});
