import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Reads a rendered PDF back, for tests. Nothing in the app imports this — it
 * exists so a test can assert what actually landed on the page rather than
 * what the renderer believes it drew.
 */
// pdf.js reads the 14 standard fonts' metrics from here; without it, every
// Helvetica page logs a standardFontDataUrl warning.
const standardFontDataUrl = join(
  dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")),
  "standard_fonts/",
);

/** Opens a rendered PDF with pdf.js. Destroy `task` when done. */
export async function openPdf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    // No worker: this runs in Node.
    useWorkerFetch: false,
    useSystemFonts: false,
    standardFontDataUrl,
  });
  return { task, doc: await task.promise };
}

export async function textOf(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const { doc: pdf } = await openPdf(bytes);

  let text = "";
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const content = await (await pdf.getPage(page)).getTextContent();
    text += content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    text += "\n";
  }

  return { text, pages: pdf.numPages };
}
