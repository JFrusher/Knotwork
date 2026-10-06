import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHAPTERS, GUIDES, chapterForRoute } from "./steps";

const ROUTES = new Set(["/", "/guests", "/seating", "/stationery", "/timeline", "/delegation", "/group-shots", "/ceremony", "/stationery?piece=order-of-service"]);

describe("the chapters", () => {
  it("has the front page, then the wedding's own pages, then one chapter per tool", () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual([
      "shell",
      "guests",
      "seating",
      "timeline",
      "place-cards",
      "delegation",
      "group-shots",
    ]);
  });

  // Longer tours get abandoned, usually partway through the first chapter —
  // see the 2026-09-07 tour design. The whole walk stays near five minutes.
  it("keeps every chapter to six steps, and the whole tour under thirty", () => {
    for (const chapter of CHAPTERS) {
      expect(chapter.steps.length, chapter.id).toBeGreaterThanOrEqual(2);
      expect(chapter.steps.length, chapter.id).toBeLessThanOrEqual(6);
    }
    expect(CHAPTERS.reduce((sum, chapter) => sum + chapter.steps.length, 0)).toBeLessThan(30);
  });

  it("gives every step words to say and a route that exists", () => {
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        expect(step.title.length, `${chapter.id}/${step.anchor}`).toBeGreaterThan(0);
        expect(step.body.length, `${chapter.id}/${step.anchor}`).toBeGreaterThan(20);
        expect(ROUTES.has(step.route), `${chapter.id}/${step.anchor} route`).toBe(true);
      }
    }
  });

  it("never repeats an anchor", () => {
    const all = CHAPTERS.flatMap((c) => c.steps.map((s) => s.anchor));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("the guides", () => {
  it("each walk one job in six steps or fewer, with words for each and routes that exist, never reusing a tour's anchor", () => {
    const tour = new Set(CHAPTERS.flatMap((c) => c.steps.map((s) => s.anchor)));
    for (const guide of GUIDES) {
      expect(guide.steps.length, guide.id).toBeLessThanOrEqual(6);
      for (const step of guide.steps) {
        expect(step.body.length, step.anchor).toBeGreaterThan(20);
        expect(ROUTES.has(step.route), `${step.anchor} route`).toBe(true);
        expect(tour.has(step.anchor), step.anchor).toBe(false);
      }
    }
  });

  it("are not in the tour, which stays short", () => {
    expect(CHAPTERS.map((c) => c.id)).not.toContain("order-of-service");
  });
});

describe("chapterForRoute", () => {
  it("asks Ceremony's help for the order of service, start to finish", () => {
    expect(chapterForRoute("/ceremony")).toBe("order-of-service");
  });

  it("maps each page with a chapter to its own", () => {
    expect(chapterForRoute("/guests")).toBe("guests");
    expect(chapterForRoute("/seating")).toBe("seating");
    expect(chapterForRoute("/group-shots")).toBe("group-shots");
  });

  it("falls back to the shell chapter for anything else", () => {
    expect(chapterForRoute("/")).toBe("shell");
    expect(chapterForRoute("/account")).toBe("shell");
  });
});

/**
 * The invariant that matters.
 *
 * A step whose anchor no longer exists degrades quietly at runtime — the card
 * shows, centred, pointing at nothing. That is right for a user and useless
 * for a maintainer, so renaming a control has to fail here instead. Follows
 * the grep-based pattern in apps/plaque/core/invariants.test.ts.
 */
describe("every anchor exists in the source", () => {
  const roots = ["app", "components", "apps", "lib"];
  const sources: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next") continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(tsx|jsx)$/.test(entry)) sources.push(readFileSync(path, "utf8"));
    }
  };
  for (const root of roots) walk(root);
  const haystack = sources.join("\n");

  for (const chapter of [...CHAPTERS, ...GUIDES]) {
    for (const step of chapter.steps) {
      it(`${chapter.id}: ${step.anchor}`, () => {
        expect(
          haystack.includes(`data-tour="${step.anchor}"`),
          `No element carries data-tour="${step.anchor}". Either add it, or fix the step.`,
        ).toBe(true);
      });
    }
  }
});

describe("the example wedding", () => {
  it("is a document the app can actually read", async () => {
    const { migrate } = await import("@jfrusher/knotwork");
    const raw = JSON.parse(
      readFileSync("public/fixtures/example-wedding.knotwork.json", "utf8"),
    ) as unknown;
    const doc = migrate(raw);
    expect(Object.keys(doc.guests).length).toBeGreaterThan(20);
    expect(doc.event.coupleNames.length).toBeGreaterThan(0);
  });
});
