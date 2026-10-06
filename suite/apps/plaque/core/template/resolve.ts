import { makeIconLookup } from "../../assets/icons";
import { fitBlock, fitGrid, fitText } from "../text/fit";
import { missingGlyphs, suggestFallback } from "../text/glyphs";
import type { LoadedFont } from "../text/measure";
import { measureWidth } from "../text/measure";
import type { ResolvedImageSource, RoomScene, ServiceBlock } from "../types";
import type { ResolveOptions } from "./bindings";

/**
 * Wires the real fitter and icon lookup into `resolveCard`.
 *
 * Everything that renders a card — the preview, the PDF, the tests, the sample
 * script — goes through this, so none of them can accidentally fit text a
 * different way from the others.
 */
export function makeResolveOptions(
  fonts: Map<string, LoadedFont>,
  uploadedIcons: Record<string, string> = {},
  images: Map<string, ResolvedImageSource> = new Map(),
  assetNames: Record<string, string> = {},
  room: RoomScene | null = null,
  service: ServiceBlock[] | null = null,
): ResolveOptions {
  const iconPath = makeIconLookup(uploadedIcons);
  return {
    iconPath,
    service: () => service,
    measure: (fontId, text, sizePt) => {
      const font = fonts.get(fontId);
      return font ? measureWidth(font, text, sizePt) : null;
    },
    image: (id) => images.get(id) ?? null,
    assetName: (id) => assetNames[id] ?? null,
    room: () => room,
    missingGlyphs: (fontId, text) => {
      const font = fonts.get(fontId);
      if (!font) return { missing: [], fallback: null };
      const { missing } = missingGlyphs(font, text);
      if (missing.length === 0) return { missing, fallback: null };
      const fallback = suggestFallback(fonts.values(), missing, fontId);
      return { missing, fallback: fallback?.family ?? null };
    },
    fitText: (el, text) => {
      const font = fonts.get(el.fontId);
      if (!font) {
        // No metrics means no honest fitting decision. Render at the requested
        // size and let the missing-font warning be the thing the user sees.
        return {
          lines: text ? [text] : [],
          fontSizePt: el.fontSizePt,
          overflowed: false,
          missingFont: true,
        };
      }
      return fitText(font, {
        text,
        boxWMm: el.w,
        boxHMm: el.h,
        fontSizePt: el.fontSizePt,
        lineHeight: el.lineHeight,
        letterSpacingMm: el.letterSpacingMm,
        fit: el.fit,
      });
    },
    fitGrid: (el, blocks, cell) => {
      const font = fonts.get(el.fontId);
      const headingFont = fonts.get(el.headingFontId);
      if (!font || !headingFont) return { fontSizePt: el.fontSizePt, overflowed: false, missingFont: true };
      return fitGrid(font, headingFont, {
        blocks,
        cellWMm: cell.w,
        cellHMm: cell.h,
        fontSizePt: el.fontSizePt,
        headingScale: el.headingScale,
        lineHeight: el.lineHeight,
        letterSpacingMm: el.letterSpacingMm,
        fit: el.fit,
      });
    },
    fitBlock: (el, lines) => {
      const font = fonts.get(el.fontId);
      if (!font) {
        return { lines, fontSizePt: el.fontSizePt, overflowed: false, missingFont: true };
      }
      return fitBlock(font, {
        lines,
        boxWMm: el.w,
        boxHMm: el.h,
        fontSizePt: el.fontSizePt,
        lineHeight: el.lineHeight,
        letterSpacingMm: el.letterSpacingMm,
        fit: el.fit,
      });
    },
  };
}
