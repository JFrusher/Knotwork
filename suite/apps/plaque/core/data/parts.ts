import { flowPlan, gridBlocks } from "../template/grid";
import type { GridElement, Template } from "../types";
import { buildArtefacts, type Artefact } from "./artefacts";
import type { GuestRow } from "./rows";

/**
 * What a design prints from these rows: one artefact per row, group or
 * document as its scope says, each cut into pages where it runs long. Every
 * place that counts, shows or prints artefacts goes through this.
 */
export function artefactsOf(template: Template, rows: GuestRow[], headers: string[], rowIds?: string[]): Artefact[] {
  return withParts(template, buildArtefacts(rows, template.rowScope ?? { kind: "per-row" }, headers, rowIds));
}

/**
 * An artefact too long for one page, as one artefact per page.
 *
 * A finder of a hundred and fifty names will not fit an A4 page at any size
 * worth reading; its columns carry on onto the next. Cutting here, before
 * imposition, is what keeps the rest of Plaque ignorant of it: the preview,
 * the counts, the warnings and the export all simply see more artefacts.
 *
 * The cut follows the design's flowing grid — the same plan its layout uses,
 * so a page holds exactly what that page prints. Every part keeps the
 * artefact's identity in its key, so a reprint of one page is a choice of one
 * part.
 */
export function withParts(template: Template, artefacts: Artefact[]): Artefact[] {
  const flow = template.elements.find(
    (el): el is GridElement => el.kind === "grid" && el.layout === "columns",
  );
  if (!flow) return artefacts;

  return artefacts.flatMap((artefact) => {
    const { blocks } = gridBlocks(flow, artefact.rows);
    const runs = flowPlan(flow, blocks.map((block) => block.rows.length));
    const pages = Math.max(0, ...runs.map((run) => run.page)) + 1;
    if (pages === 1) return [artefact];

    const indexOf = new Map(artefact.rows.map((row, i) => [row, i]));
    return Array.from({ length: pages }, (_, page) => {
      const picked = runs
        .filter((run) => run.page === page)
        .flatMap((run) => blocks[run.block]!.rows.slice(run.from, run.to))
        .map((row) => indexOf.get(row)!);
      const rows = picked.map((i) => artefact.rows[i]!);
      return {
        key: `${artefact.key}#${page + 1}`,
        row: rows[0] ?? artefact.row,
        rows,
        rowIndexes: picked.map((i) => artefact.rowIndexes[i]!),
        // The artefact's own: a design tweak to it applies to every page.
        rowId: artefact.rowId,
        rowIds: picked.map((i) => artefact.rowIds[i]!),
        label: `${artefact.label} — page ${page + 1} of ${pages}`,
      };
    });
  });
}
