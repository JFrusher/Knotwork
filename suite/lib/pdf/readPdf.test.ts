import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { textOf } from "./readPdf";

afterEach(() => vi.restoreAllMocks());

describe("textOf", () => {
  it("reads a standard-font PDF without pdf.js asking for its font data", async () => {
    const doc = await PDFDocument.create();
    doc.addPage().drawText("Table 4", { font: await doc.embedFont(StandardFonts.Helvetica) });
    const said: unknown[] = [];
    vi.spyOn(console, "log").mockImplementation((...a) => void said.push(...a));
    vi.spyOn(console, "warn").mockImplementation((...a) => void said.push(...a));

    const { text } = await textOf(await doc.save());

    expect(text).toContain("Table 4");
    expect(said.join("\n")).not.toContain("standardFontDataUrl");
  });
});
