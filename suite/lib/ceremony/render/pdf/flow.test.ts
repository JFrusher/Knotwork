import { describe, expect, it } from "vitest";
import { nodeFontSource } from "@/lib/pdf/nodeFontSource";
import { textOf } from "@/lib/pdf/readPdf";
import { renderFlow } from "./flow";

describe("a passage longer than a page", () => {
  it("carries on onto the next page, with every line on paper", async () => {
    const lines = Array.from({ length: 120 }, (_, i) => `Line ${i + 1} of the vows`);
    const bytes = await renderFlow([{ lines: [{ text: "The vows", bold: true }, { text: lines.join("\n") }] }], {
      fontSource: nodeFontSource,
      size: "A5",
      title: "The order of service",
    });
    const { text, pages } = await textOf(bytes);
    expect(pages).toBeGreaterThan(1);
    // The reader sees only what lies on a page, so a line drawn past its foot is missing here.
    for (const line of lines) expect(text).toContain(line);
  });
});
