import type { jsPDF as JsPdf } from 'jspdf'
import { buildFloorPlanSvg, measureFloorPlan, type Bounds, type FloorPlanSource, type Measure } from './floorPlanSvg'

// jsPDF + svg2pdf are heavy and only needed on export, so they are dynamically
// imported (kept out of the main bundle).
async function loadPdf() {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])
  return { jsPDF, svg2pdf }
}

/** How the plan is laid across sheets: fitted to one unless the type would go illegible. */
export type Pages = 'auto' | 'single' | 'split'

// ── one-page seating chart ──────────────────────────────────────────────────
// Flip PAGE_FORMAT to 'a3' for an entrance-board sized print; everything else
// (orientation, fit scale, type size) follows from the page dimensions.
//
// The margins are deliberately tight. This is a working sheet that gets pinned
// up or carried round a room, not a document with a house style, and every
// point given to a margin comes straight off the names.
const PAGE_FORMAT = 'a4'
const MARGIN = 8
const HEADER = 12 // vertical band above the plan for the title
const PLAN_PAD = 8 // clear ground drawn around the plan itself
const MAX_NAME_PT = 16
const FONT_FLOOR_PT = 6 // below this the plan is tiled across two sheets
const TILE_OVERLAP = 0.05

/**
 * Work out how the plan is laid across sheets.
 * `pages`: 'auto' splits only when a single sheet would drop below
 * FONT_FLOOR_PT, 'single' always keeps one sheet (however small the type),
 * 'split' always tiles across two.
 * Returns the fit scale, the name point size and one window per sheet.
 *
 * The cell size and the type that fits it are solved against the plan itself by
 * measureFloorPlan; all this does is scale that onto paper.
 */
export function planSheets(
  m: Bounds & { basePx: number },
  availW: number,
  availH: number,
  pages: Pages = 'auto'
): { scale: number; basePt: number; windows: Bounds[] } {
  const fit = (w: number, h: number) => Math.min(availW / w, availH / h)
  const solve = (s: number) => Math.min(m.basePx * s, MAX_NAME_PT)

  let scale = fit(m.width, m.height)
  let basePt = solve(scale)
  let windows: Bounds[] = [{ minX: m.minX, minY: m.minY, width: m.width, height: m.height }]
  if (pages === 'single' || (pages === 'auto' && basePt >= FONT_FLOOR_PT)) {
    return { scale, basePt, windows }
  }

  // Split along the longer axis into two overlapping sheets.
  // ponytail: two tiles only — a plan that still can't reach the floor at 2×
  // just prints small. Generalise to N tiles if that ever shows up.
  const horiz = m.width >= m.height
  const step = (horiz ? m.width : m.height) / 2
  const over = step * TILE_OVERLAP
  const tileW = horiz ? step + over : m.width
  const tileH = horiz ? m.height : step + over
  const tiled = fit(tileW, tileH)
  if (pages === 'auto' && tiled <= scale) return { scale, basePt, windows }

  scale = tiled
  basePt = solve(scale)
  windows = [0, 1].map((i) => ({
    minX: m.minX + (horiz ? Math.max(0, i * step - over) : 0),
    minY: m.minY + (horiz ? 0 : Math.max(0, i * step - over)),
    width: tileW,
    height: tileH,
  }))
  return { scale, basePt, windows }
}

/**
 * A single-sheet, to-scale seating chart: every seat is a rectangle holding the
 * guest's first and last name, printed where they actually sit. Every name is set
 * at one size, chosen so the 90th-percentile name fits its cell — the few longer
 * than that are cut rather than allowed to shrink the whole sheet. `opts.pages` picks the sheet
 * count: 'auto' (default) tiles across two sheets only if one sheet would go
 * illegible, 'single' forces one sheet, 'split' always tiles.
 */
/**
 * The floor plan as PDF bytes.
 *
 * Split out from `exportFloorPlanPdf` so the same drawing can either be handed
 * straight to the browser as a download or folded into the wedding pack
 * alongside the run sheet and the job list. Everything below builds the page;
 * only the last step differs.
 */
export async function buildFloorPlanPdf(doc: FloorPlanSource, name: string, opts: { pages?: Pages } = {}): Promise<JsPdf> {
  const { jsPDF, svg2pdf } = await loadPdf()
  const planOpts = { ...opts, padPx: PLAN_PAD }

  // The plan's own shape picks the sheet's, so a tall room stops wasting half a
  // landscape page. Measured with the built-in estimator because there is no
  // document to measure against yet; the exact fit is redone below.
  const rough = measureFloorPlan(doc, planOpts)
  const orientation = rough.width >= rough.height ? 'landscape' : 'portrait'

  const pdf = new jsPDF({ orientation, unit: 'pt', format: PAGE_FORMAT })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const availW = pageW - MARGIN * 2
  const availH = pageH - MARGIN * 2 - HEADER

  // Real metrics from the PDF's own Helvetica, so the fit is exact.
  const measure: Measure = (text, size) => pdf.getStringUnitWidth(String(text)) * size

  const fit = (b: Bounds) => Math.min(availW / b.width, availH / b.height)
  const m = measureFloorPlan(doc, { ...planOpts, measure, fit })
  const { scale, basePt, windows } = planSheets(m, availW, availH, opts.pages)

  // One cell size and one type size for the whole sheet. basePt is what actually
  // prints, so divide it back out rather than re-solving and risking a disagreement.
  const cells = { cellW: m.cellW, cellH: m.cellH, basePx: basePt / scale }
  const title = name || 'Seating plan'

  for (const [i, win] of windows.entries()) {
    if (i > 0) pdf.addPage(PAGE_FORMAT, orientation)
    // Title and sheet note share one baseline: a second header line would cost
    // more of the page than it tells anyone.
    pdf.setFontSize(11)
    pdf.setTextColor(40)
    pdf.text(title, MARGIN, MARGIN + 8)
    if (windows.length > 1) {
      pdf.setFontSize(8)
      pdf.setTextColor(130)
      pdf.text(`Sheet ${i + 1} of ${windows.length}`, pageW - MARGIN, MARGIN + 8, { align: 'right' })
    }

    const { svg, width, height } = buildFloorPlanSvg(doc, {
      ...planOpts,
      seatLabels: 'name',
      cells,
      measure,
      window: win,
    })
    const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement as unknown as SVGElement
    // A to-scale plan rarely matches the page's aspect ratio, so centre it on
    // both axes rather than leaving all the slack at the bottom.
    await svg2pdf(el, pdf, {
      x: MARGIN + (availW - width * scale) / 2,
      y: MARGIN + HEADER + (availH - height * scale) / 2,
      width: width * scale,
      height: height * scale,
    })
  }

  return pdf
}
