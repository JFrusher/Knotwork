import { rebindTemplate } from "../template/rebind";
import type { CardSpec, SheetSpec, Template } from "../types";
import escortCard from "../../templates/escort-card.json";
import finder from "../../templates/finder.json";
import floorPlan from "../../templates/floor-plan.json";
import placeCardClassic from "../../templates/place-card-classic.json";
import seatingBoard from "../../templates/seating-board.json";
import tableCard from "../../templates/table-card.json";
import serviceDockets from "../../templates/service-dockets.json";
import tableMenu from "../../templates/table-menu.json";

/**
 * The starter gallery (F2) — designs as files in `templates/`.
 *
 * Two jobs from one directory, which is why it earns its keep: a contributor
 * adds a `.json` and it appears in the picker, and every entry is exercised by
 * the test corpus, so a template that no longer renders fails the build rather
 * than the user's evening.
 *
 * A gallery entry is a DESIGN, not a project: no guest list, no assets. Applying
 * one keeps whatever data is already loaded, and rebinding re-attaches its
 * tokens to that data's columns.
 */
export const GALLERY_FORMAT = "plaque-template";
export const GALLERY_VERSION = 1;

export interface GalleryTemplate {
  format: typeof GALLERY_FORMAT;
  version: number;
  id: string;
  name: string;
  description: string;
  card: Pick<CardSpec, "widthMm" | "heightMm" | "fold" | "foldPositionMm" | "bleedMm">;
  /** What a design needs of the sheet, when it is more than paper — a board printed at its own size. */
  sheet?: Partial<SheetSpec>;
  template: Template;
}

/**
 * Named rather than globbed. Vite inlined the whole directory at build time;
 * Next has no equivalent, so they are listed — which a bundler can check,
 * where a glob cannot.
 */
const FILES: Record<string, unknown> = {
  "escort-card.json": escortCard,
  "finder.json": finder,
  "floor-plan.json": floorPlan,
  "place-card-classic.json": placeCardClassic,
  "seating-board.json": seatingBoard,
  "table-card.json": tableCard,
  "service-dockets.json": serviceDockets,
  "table-menu.json": tableMenu,
};

/** Returns the offending field, or null. Named so a bad contribution is findable. */
export function validateGalleryTemplate(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return "not an object";
  const t = value as Record<string, unknown>;
  if (t["format"] !== GALLERY_FORMAT) return "format";
  if (t["version"] !== GALLERY_VERSION) return "version";
  for (const key of ["id", "name", "description"]) {
    if (typeof t[key] !== "string" || !t[key]) return key;
  }
  if (typeof t["card"] !== "object" || t["card"] === null) return "card";
  const card = t["card"] as Record<string, unknown>;
  for (const key of ["widthMm", "heightMm", "foldPositionMm", "bleedMm"]) {
    const n = card[key];
    if (typeof n !== "number" || !Number.isFinite(n)) return `card.${key}`;
  }
  if (t["sheet"] !== undefined && (typeof t["sheet"] !== "object" || t["sheet"] === null)) return "sheet";
  const template = t["template"] as Record<string, unknown> | undefined;
  if (!template || !Array.isArray(template["elements"])) return "template.elements";
  if (template["elements"].length === 0) return "template.elements";

  // Every element needs the fields the resolver reads; a half-written one would
  // render as nothing at all, which is the failure a gallery must not ship.
  for (const [index, element] of (template["elements"] as unknown[]).entries()) {
    if (typeof element !== "object" || element === null) return `template.elements[${index}]`;
    const el = element as Record<string, unknown>;
    if (typeof el["kind"] !== "string" || typeof el["id"] !== "string") {
      return `template.elements[${index}].kind`;
    }
    for (const key of ["x", "y", "w", "h", "z"]) {
      if (typeof el[key] !== "number" || !Number.isFinite(el[key])) {
        return `template.elements[${index}].${key}`;
      }
    }
  }
  return null;
}

export const GALLERY: GalleryTemplate[] = Object.entries(FILES)
  .flatMap(([path, value]) => {
    const bad = validateGalleryTemplate(value);
    if (bad) {
      console.error(`${path}: invalid "${bad}" — leaving it out of the gallery.`);
      return [];
    }
    return [value as GalleryTemplate];
  })
  .sort((a, b) => a.name.localeCompare(b.name));

/** The columns gallery designs are written against. */
const SAMPLE_HEADERS = ["First Name", "Last Name", "Table", "Dietary"];

/**
 * A gallery design over a piece's card and sheet: its sizes, and its template
 * rebound to the columns the data has (S-B.1), with no per-guest tweaks.
 */
export function fromGallery(
  entry: GalleryTemplate,
  card: CardSpec,
  sheet: SheetSpec,
  headers: string[],
): { card: CardSpec; sheet: SheetSpec; template: Template } {
  return {
    card: { ...card, ...entry.card },
    sheet: { ...sheet, ...entry.sheet },
    template: rebindTemplate({ ...entry.template, overrides: {} }, SAMPLE_HEADERS, headers).template,
  };
}
