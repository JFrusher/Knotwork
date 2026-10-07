import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { guestBlocks } from "@/lib/ceremony/guestCopy";
import { ceremonyPlace } from "@/lib/ceremony/checks";
import { orderRows } from "@/lib/ceremony/rows";
import { dayPlaces, readCast, readCeremony, readGuests, readSeating } from "@/lib/model/slices";
import { textOf } from "@/lib/pdf/readPdf";
import { BUNDLED_FONTS } from "../assets/fonts";
import { renderPdf } from "../render/pdf/renderPdf";
import { bookletOrder, bookletRows, PAGE_COLUMN, PAGE_ROLE_COLUMN } from "./data/booklet";
import { buildJob } from "./job";
import { defaultSheet } from "./template/defaults";
import { ELEMENT_KINDS } from "./template/registry";
import { GALLERY, fromGallery } from "./data/gallery";
import { bookletFacts } from "../state/fromCeremony";
import { makeResolveOptions } from "./template/resolve";
import { paginateService, typesetService } from "./template/service";
import { loadFont, type LoadedFont } from "./text/measure";
import type { CardElement, CardSpec, ServiceBlock, ServiceElement, Template } from "./types";

const fonts = new Map<string, LoadedFont>(
  BUNDLED_FONTS.map((f) => [f.id, loadFont(f.id, f.family, new Uint8Array(readFileSync(`public/fonts/${f.file}`)))]),
);
const measure = makeResolveOptions(fonts).measure!;

const doc = migrate(JSON.parse(readFileSync("public/fixtures/example-wedding.knotwork.json", "utf8")));
const ceremony = readCeremony(doc);
const blocks: ServiceBlock[] = guestBlocks(
  orderRows(ceremony, readGuests(doc), readSeating(doc), readCast(doc), doc.event, ceremonyPlace(ceremony, dayPlaces(doc)).place),
  ceremony.guestCopy,
);

const a5: CardSpec = { widthMm: 148, heightMm: 210, fold: "none", foldPositionMm: 0, invertBackPanel: false, bleedMm: 0 };
const make = (kind: CardElement["kind"], id: string) => ELEMENT_KINDS.find((spec) => spec.kind === kind)!.create({ id, z: 1, card: a5, headers: [] });
const service = make("service", "service") as ServiceElement;

const text = (id: string, template: string, page: CardElement["page"]): CardElement => ({ ...make("text", id), template, page } as CardElement);
const design: Template = {
  backgroundHex: null,
  elements: [
    text("cover", "{{Couple}}", "cover"),
    service,
    { ...make("rect", "photo"), page: "inside", onPages: [3] } as CardElement,
    text("folio", "{{Page}}", "inside"),
    text("back", "Thank you", "back"),
  ],
};

const pagesOfService = paginateService(typesetService(blocks, service, measure).lines, service.h).length;
const { rows, rowIds } = bookletRows({ Couple: "Alex & Sam" }, pagesOfService);
const resolve = makeResolveOptions(fonts, {}, new Map(), {}, null, blocks);
const job = (over: Partial<Parameters<typeof buildJob>[0]> = {}) =>
  buildJob({ template: design, card: a5, sheet: defaultSheet(), rows, rowIds, headers: Object.keys(rows[0]!), resolve, ...over });

describe("a booklet's pages", () => {
  it("are a cover, the inside pages and a back, padded to fold", () => {
    const { rows: three } = bookletRows({}, 3);
    expect(three).toHaveLength(8);
    expect(three.map((row) => row[PAGE_ROLE_COLUMN])).toEqual(["cover", ...Array(6).fill("inside"), "back"]);
    expect(bookletRows({}, 2).rows).toHaveLength(4);
    expect(bookletRows({}, 0).rows).toHaveLength(4);
  });

  it("fold in printing order: outside of each sheet first", () => {
    expect(bookletOrder(4)).toEqual([3, 0, 1, 2]);
    expect(bookletOrder(8)).toEqual([7, 0, 1, 6, 5, 2, 3, 4]);
    expect(() => bookletOrder(6)).toThrow(/multiple of four/);
  });
});

describe("the order of service, flowed", () => {
  it("carries a reading longer than a page over, losing no line", () => {
    const long: ServiceBlock = {
      title: "The vows",
      author: "",
      note: "",
      people: [],
      music: [], lines: [],
      passages: [{ text: Array.from({ length: 90 }, (_, i) => `Line ${i + 1}`).join("\n"), layout: "poem" }],
    };
    const { lines } = typesetService([long], service, measure);
    const pages = paginateService(lines, service.h);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat().map((line) => line.text)).toEqual(lines.map((line) => line.text));
  });

  it("never leaves a title alone at the foot of a page", () => {
    const parts: ServiceBlock[] = Array.from({ length: 30 }, (_, i) => ({
      title: `Part ${i + 1}`,
      author: "",
      note: "",
      people: ["A reader"],
      music: [], lines: [],
      passages: [],
    }));
    for (const page of paginateService(typesetService(parts, service, measure).lines, service.h)) {
      expect(page.at(-1)!.kind).not.toBe("heading");
    }
  });

  it("sets everyone's lines in responses in the congregation's face, from the left", () => {
    const responses: ServiceBlock = { title: "The vows", author: "", note: "", people: [], music: [], lines: [], passages: [{ text: "Will you?\nAll: We will.", layout: "responses" }] };
    const lines = typesetService([responses], service, measure).lines;
    expect(lines.map((line) => [line.kind, line.align])).toEqual([["heading", "center"], ["words", "left"], ["all", "left"]]);
  });
});

describe("a booklet printed at home", () => {
  it("puts two pages to a side in folding order, and every word of the service on paper", async () => {
    const built = job({ booklet: { paper: "A4", flipEdge: "short" } });
    expect(built.sheets).toHaveLength(rows.length / 2);
    expect(built.sheets[0]!.pageWidthMm).toBeCloseTo(297);
    expect(built.sheets[0]!.cards.map((card) => card.scene.elements.some((el) => el.id === "cover"))).toEqual([false, true]);

    const { text } = await textOf((await renderPdf({ sheets: built.sheets, fonts })).bytes);
    expect(text).toContain("Alex & Sam");
    expect(text).toContain("Let me not to the marriage of true minds");
    expect(text).toContain("I never writ, nor no man ever lov'd.");
    expect(text).toContain("Canon in D — Johann Pachelbel");
    expect(text).toContain("Thank you");
  });

  it("shows a picture only on the pages chosen", () => {
    const built = job({ booklet: { paper: "A4", flipEdge: "short" } });
    const pagesWithPhoto = built.sheets
      .flatMap((sheet) => sheet.cards)
      .filter((card) => card.scene.elements.some((el) => el.id === "photo"))
      .map((card) => rows[bookletOrder(rows.length)[card.artefactIndex]!]![PAGE_COLUMN]);
    expect(pagesWithPhoto).toEqual(["3"]);
  });

  it("turns the backs over for a printer that flips on the long edge", () => {
    const short = job({ booklet: { paper: "A4", flipEdge: "short" } }).sheets;
    const long = job({ booklet: { paper: "A4", flipEdge: "long" } }).sheets;
    expect(long[0]).toEqual(short[0]);
    const folio = (sheets: typeof short) => sheets[1]!.cards[0]!.scene.elements.find((el) => el.id === "folio")!;
    expect(folio(long).rotationDeg).toBe(180);
    expect(folio(long).x).toBeCloseTo(297 - folio(short).x - folio(short).w);
  });

  it("refuses paper two pages will not fit side by side on", () => {
    expect(() => job({ booklet: { paper: "LETTER", flipEdge: "short" } })).toThrow(/do not fit side by side on LETTER/);
  });
});

describe("a booklet for a print shop", () => {
  it("is each page on its own, in reading order", () => {
    const sheet = { ...defaultSheet(), page: "FIT" as const, cropMarks: true };
    const built = job({ sheet });
    expect(built.sheets).toHaveLength(rows.length);
    expect(built.sheets[0]!.cards[0]!.scene.elements.some((el) => el.id === "cover")).toBe(true);
    expect(built.sheets.at(-1)!.cards[0]!.scene.elements.some((el) => el.id === "back")).toBe(true);
  });
});

describe("the booklet designs in the gallery", () => {
  it("print the example wedding's whole service, nothing overflowing, folded at home", async () => {
    const designs = GALLERY.filter((entry) => entry.booklet);
    expect(designs.length).toBeGreaterThan(0);
    for (const entry of designs) {
      const { card, sheet, template } = fromGallery(entry, a5, defaultSheet(), []);
      const box = template.elements.find((el): el is ServiceElement => el.kind === "service")!;
      const inside = paginateService(typesetService(blocks, box, measure).lines, box.h).length;
      const pages = bookletRows(bookletFacts(doc), inside);
      const built = buildJob({ template, card, sheet, ...pages, headers: Object.keys(pages.rows[0]!), resolve, booklet: { paper: "A4", flipEdge: "short" } });
      expect([entry.id, built.warnings.filter((w) => w.kind === "overflow" || w.kind === "missing-font")]).toEqual([entry.id, []]);
      const { text } = await textOf((await renderPdf({ sheets: built.sheets, fonts })).bytes);
      for (const expected of ["Alex", "Sonnet 116", "I never writ, nor no man ever lov'd.", "The recessional"]) {
        expect([entry.id, text.includes(expected)]).toEqual([entry.id, true]);
      }
    }
  });
});
