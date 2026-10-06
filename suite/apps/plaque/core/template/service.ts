import { ptToMm } from "../units";
import type { HAlign, Mm, Pt, ServiceBlock, ServiceElement, ServiceStyle } from "../types";

/** A string's width in a face at a size, or null when the face is not loaded. */
export type MeasureFn = (fontId: string, text: string, sizePt: Pt) => Mm | null;

/** Which style a line is set in: everyone's lines in responses are `all`. */
type LineKind = "heading" | "detail" | "words" | "all";

/** One line of the order of service, set and measured, before it is placed on a page. */
export interface ServiceLine {
  text: string;
  kind: LineKind;
  align: HAlign;
  /** Space above it, dropped at the top of a page. */
  gapMm: Mm;
  heightMm: Mm;
  /** It goes over the page with the line after it: a title is never alone at a page's foot. */
  keepWithNext: boolean;
}

interface Typeset {
  lines: ServiceLine[];
  /** A face it needed was not loaded, so its lines are unbroken guesses. */
  missingFont: boolean;
}

/** The style a line of a kind is set in. */
export function styleOf(el: ServiceElement, kind: LineKind): ServiceStyle {
  return kind === "all" ? { ...el.words, fontId: el.congregationFontId } : el[kind];
}

/**
 * The order of service as lines, each set in its style and broken to the
 * box's width: a part's title, its details, then its words.
 */
export function typesetService(blocks: ServiceBlock[], el: ServiceElement, measure: MeasureFn): Typeset {
  let missingFont = false;
  const lines: ServiceLine[] = [];
  const heightOf = (kind: LineKind) => ptToMm(styleOf(el, kind).fontSizePt * el.lineHeight);

  const push = (text: string, kind: LineKind, align: HAlign, gapMm: Mm, keepWithNext: boolean) => {
    const style = styleOf(el, kind);
    const broken = text.trim() === "" ? [""] : wrap(text, (part) => measure(style.fontId, part, style.fontSizePt), el.w);
    if (broken === null) missingFont = true;
    (broken ?? [text]).forEach((line, i) =>
      lines.push({ text: line, kind, align, gapMm: i === 0 ? gapMm : 0, heightMm: heightOf(kind), keepWithNext }),
    );
  };

  blocks.forEach((block, index) => {
    const passages = block.passages.filter((passage) => passage.text.trim() !== "");
    const details = [block.author, block.note, block.people.join(" and "), ...block.music, ...block.lines].filter(Boolean);
    const gap = index === 0 ? 0 : el.gapMm;
    // The couple's own notes have no heading: their words open the part.
    if (block.title) push(block.title, "heading", el.align, gap, details.length > 0 || passages.length > 0);
    details.forEach((detail, i) => push(detail, "detail", el.align, block.title || i > 0 ? 0 : gap, i < details.length - 1 || passages.length > 0));
    passages.forEach((passage, p) => {
      const opens = !block.title && details.length === 0 && p === 0;
      const gap = opens ? (index === 0 ? 0 : el.gapMm) : heightOf("words") / 2;
      passage.text.split("\n").forEach((part, i) => {
        const kind: LineKind = passage.layout === "responses" && /^\s*all\s*:/i.test(part) ? "all" : "words";
        const align = passage.layout === "poem" ? el.align : "left";
        push(part, kind, align, i === 0 ? gap : 0, false);
      });
    });
  });

  return { lines, missingFont };
}

/**
 * The lines, page by page, in a box `heightMm` tall. A line goes over the page
 * with the ones it keeps with, unless they fill a page between them; every
 * page holds at least one line, so a box too small for any still ends.
 */
export function paginateService(lines: ServiceLine[], heightMm: Mm): ServiceLine[][] {
  const pages: ServiceLine[][] = [];
  let page: ServiceLine[] = [];
  let used = 0;
  const cost = (line: ServiceLine, top: boolean) => (top ? 0 : line.gapMm) + line.heightMm;

  lines.forEach((line, index) => {
    // The run that must stay together: this line and those it keeps with.
    let runMm = cost(line, page.length === 0);
    for (let next = index; lines[next]?.keepWithNext && lines[next + 1]; next++) runMm += cost(lines[next + 1]!, false);
    const fitsAlone = cost(line, page.length === 0) + used <= heightMm + 1e-6;
    const runFits = used + runMm <= heightMm + 1e-6;
    const runFitsAPage = runMm - line.gapMm <= heightMm;
    if (page.length > 0 && (!fitsAlone || (line.keepWithNext && !runFits && runFitsAPage))) {
      pages.push(page);
      page = [];
      used = 0;
    }
    used += cost(line, page.length === 0);
    page.push(line);
  });
  if (page.length > 0) pages.push(page);
  return pages;
}

/** Words to lines no wider than `widthMm`; null when a width cannot be measured. */
function wrap(text: string, width: (part: string) => Mm | null, widthMm: Mm): string[] | null {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    const measured = width(candidate);
    if (measured === null) return null;
    if (measured <= widthMm || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}
