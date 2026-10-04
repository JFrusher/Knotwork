"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import styles from "./App.module.css";
import { BUNDLED_FONTS } from "./assets/fonts";
import { validateGeometry } from "./core/geometry/validate";
import { analyseArtefacts, paginate, sheetCountFor } from "./core/imposition/paginate";
import { buildArtefacts } from "./core/data/artefacts";
import { hasBackSide, templateForSide } from "./core/imposition/duplex";
import { templateForRow } from "./core/template/overrides";
import { PAPER_WHITE, contrastIssues } from "./core/print/contrast";
import { missingAssets } from "./core/template/assets";
import { overflowIssues } from "./core/template/overflow";
import { unboundTokens } from "./core/template/rebind";
import { makeResolveOptions } from "./core/template/resolve";
import { CardCanvas, MAX_VIEW_ZOOM } from "./render/svg/CardCanvas";
import { SheetPreview } from "./render/svg/SheetPreview";
import { loadFonts as loadStoredFonts } from "./state/blobStore";
import { loadImages, toSource } from "./state/imageStore";
import { loadPrinters } from "./state/printerStore";
import { loadBundledFonts, registerFont } from "./state/fontLoader";
import { designOf } from "./state/design";
import { writeDesign } from "./state/sliceBridge";
import { usePlaque } from "./state/store";
import { useKeyboard } from "./state/useKeyboard";
import { Announcer } from "./ui/Announcer";
import { ToolUndo } from "@/components/shell/ToolUndo";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { ExportBar } from "./ui/ExportBar";
import { MissingAssets } from "./ui/MissingAssets";
import { Pagination } from "./ui/Pagination";
import { PersistenceBar } from "./ui/PersistenceBar";
import { PiecesBar } from "./ui/PiecesBar";
import { RowsDrawer } from "./ui/RowsDrawer";
import { Sidebar } from "./ui/Sidebar";
import { WarningsList } from "./ui/WarningsList";

const PLACEHOLDER_ROW = { "": "" };

/** Absent scope means per-row: what every design written before scope existed meant. */
const PER_ROW = { kind: "per-row" } as const;

export function App() {
  const [ready, setReady] = useState(false);
  // Place cards keep no history of their own: every design edit is on the
  // wedding's, which the header's undo drives. The stack is shared, so saying
  // what the next undo takes back is what makes it safe.
  // A save the browser refused, whichever slice it was: the design is in it.
  const saveError = useKnotworkStore((s) => s.saveError);
  useKeyboard();

  // App genuinely needs most of the design to draw the card, but it selects
  // explicitly so it re-renders on state it actually uses and no more. The
  // sidebar is memoised separately and does not re-render with App.
  const {
    card,
    sheet,
    template,
    rows,
    rowIds,
    headers,
    fonts,
    images,
    uploadedIcons,
    assetNames,
    page,
    selectedId,
    cropId,
    snapEnabled,
    sheetCollapsed,
    previewGuestIndex,
    editingSide,
    printers,
    activePrinterId,
    designProblem,
  } = usePlaque(
    useShallow((s) => ({
      card: s.card,
      sheet: s.sheet,
      template: s.template,
      rows: s.rows,
      rowIds: s.rowIds,
      headers: s.headers,
      fonts: s.fonts,
      images: s.images,
      uploadedIcons: s.uploadedIcons,
      assetNames: s.assetNames,
      page: s.page,
      selectedId: s.selectedId,
      cropId: s.cropId,
      snapEnabled: s.snapEnabled,
      sheetCollapsed: s.sheetCollapsed,
      previewGuestIndex: s.previewGuestIndex,
      editingSide: s.editingSide,
      printers: s.printers,
      activePrinterId: s.activePrinterId,
      designProblem: s.designProblem,
    })),
  );

  // Actions never change identity in zustand, so they are read once.
  const {
    select,
    setElementBox,
    setElementCrop,
    setCropId,
    setPage,
    setPreviewGuestIndex,
    toggleSheetCollapsed,
  } = usePlaque.getState();

  // How much bigger than "fits the pane" the card is drawn. View state, not
  // design: it belongs to this window and is not worth persisting.
  const [zoom, setZoom] = useState(1);

  // Load fonts, images and printers once, before the first render of the
  // canvas. The design needs no loading: it is the wedding's, already here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bundled = await loadBundledFonts();
      const labels: Record<string, string> = {};
      for (const f of BUNDLED_FONTS) labels[f.id] = f.label;

      const stored = await loadStoredFonts();
      for (const f of stored) {
        try {
          bundled.set(f.id, await registerFont(f.id, f.family, f.data));
          labels[f.id] = f.family;
        } catch {
          // A font that no longer parses should not stop the app from opening.
        }
      }
      const storedImages = await loadImages();
      const { printers, activeId } = await loadPrinters();
      if (cancelled) return;

      usePlaque.getState().setPrinters(printers, activeId);

      usePlaque.getState().setImages(
        new Map(storedImages.map((i) => [i.id, toSource(i)])),
        Object.fromEntries(storedImages.map((i) => [i.id, i.name])),
      );

      usePlaque.getState().setFonts(bundled, labels, stored.map((f) => f.id));
      setReady(true);
    })().catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Esc leaves crop mode, the way it leaves every other transient mode.
  useEffect(() => {
    if (!cropId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCropId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cropId, setCropId]);

  const resolveOptions = useMemo(
    () => makeResolveOptions(fonts, uploadedIcons, images, assetNames),
    [fonts, uploadedIcons, images, assetNames],
  );

  // Rows become artefacts once, here. Everything downstream counts artefacts:
  // 150 guests is 150 place cards, or 19 table menus, or one run-sheet.
  const artefacts = useMemo(
    () => buildArtefacts(rows, template.rowScope ?? PER_ROW, headers, rowIds),
    [rows, template.rowScope, headers, rowIds],
  );

  const previewArtefact = artefacts[previewGuestIndex] ?? artefacts[0] ?? null;
  const previewRow = previewArtefact?.row ?? PLACEHOLDER_ROW;

  // The card editor shows one side at a time. Sheet preview stays front-only:
  // the back sheet is a print artefact, and its mirroring is proven by the
  // duplex test sheet rather than by a preview nobody can hold up to a window.
  const editableTemplate = useMemo(() => {
    // The editor shows the card as it will actually print: one side, with this
    // row's own overrides applied. Editing against anything else would mean the
    // preview and the sheet disagree, which is the one thing Plaque must not do.
    const sided = hasBackSide(template) ? templateForSide(template, editingSide) : template;
    return previewArtefact ? templateForRow(sided, previewArtefact.rowId) : sided;
  }, [template, editingSide, previewArtefact]);

  // Row-independent, so this gates export without resolving a single card.
  const missing = useMemo(
    () => missingAssets(template, (id) => images.has(id), (id) => fonts.has(id)),
    [template, images, fonts],
  );

  // How many sheets the job needs, without building any of them.
  const sheetCount = useMemo(
    () => sheetCountFor(artefacts.length, card, sheet),
    [artefacts.length, card, sheet],
  );
  const pageIndex = Math.min(page, Math.max(0, sheetCount - 1));

  // Only the sheet on screen is imposed. Building all nineteen on every drag
  // frame is what put the editor under 60fps.
  const currentSheet = useMemo(() => {
    // A collapsed pane imposes nothing. On a big job that is the difference
    // between a keystroke costing one card and costing a whole sheet.
    if (sheetCollapsed) return undefined;
    const range = { from: pageIndex, to: pageIndex };
    const front = templateForSide(template, "front");
    return paginate(front, artefacts, card, sheet, resolveOptions, { pages: range }).sheets[0];
  }, [template, artefacts, card, sheet, resolveOptions, pageIndex, sheetCollapsed]);

  // The "these names do not fit" pass has to look at every guest, so it runs at
  // a lower priority: it may lag a drag by a frame, but it never blocks one.
  const deferredTemplate = useDeferredValue(template);
  const deferredCard = useDeferredValue(card);
  const deferredArtefacts = useDeferredValue(artefacts);
  const analysis = useMemo(
    () => analyseArtefacts(deferredTemplate, deferredArtefacts, deferredCard, resolveOptions),
    [deferredTemplate, deferredArtefacts, deferredCard, resolveOptions],
  );
  const warnings = analysis.warnings;

  const printer = printers.find((p) => p.id === activePrinterId) ?? null;
  const geometryIssues = useMemo(
    () =>
      validateGeometry(card, sheet, {
        ...(printer?.name ? { printerName: printer.name } : {}),
        ...(printer?.unprintableMarginMm === undefined
          ? {}
          : { unprintableMarginMm: printer.unprintableMarginMm }),
      }),
    [card, sheet, printer],
  );

  // Two more checks that belong beside the geometry ones: ink the stock will
  // swallow (E4), and tokens naming a column this CSV does not have (E5).
  const issues = useMemo(() => {
    const stock = template.backgroundHex ?? PAPER_WHITE;
    const contrast = contrastIssues(template.elements, stock).map((issue) => ({
      id: `contrast-${issue.elementId}`,
      severity: (issue.verdict === "poor" ? "error" : "warning") as "error" | "warning",
      message: `${issue.inkHex} on ${stock} is ${issue.ratio} — ${
        issue.verdict === "poor"
          ? "too close to the stock to read across a table."
          : "marginal on this stock in poor light."
      }`,
    }));
    // Advisory: artwork can be run off the edge on purpose. Finding out from
    // the cut sheet is what this exists to prevent.
    const overflow = overflowIssues(template.elements, card).map((issue) => ({
      id: `overflow-${issue.elementId}-${issue.kind}`,
      severity: "warning" as const,
      message: issue.detail,
    }));
    const unbound = unboundTokens(template, headers).map((token) => ({
      id: `unbound-${token}`,
      severity: "error" as const,
      message: `Nothing in this CSV is called "${token}", so it will print as a gap. Rename the column or edit the element.`,
    }));
    return [...geometryIssues, ...contrast, ...overflow, ...unbound];
  }, [geometryIssues, template, headers, card]);

  if (!ready) return <p className={styles.status}>Loading fonts…</p>;

  return (
    <div className={styles.app}>
      <ToolUndo />

      <Announcer />
      <Sidebar />

      <div className={styles.main}>
        <PiecesBar />
        {saveError && (
          <PersistenceBar
            reason={saveError}
            onRetry={() => writeDesign(designOf(usePlaque.getState()), usePlaque.getState().pieceId, { silent: true })}
          />
        )}

        {designProblem && <p className={styles.notice}>{designProblem}</p>}

        <div className={sheetCollapsed ? `${styles.workspace} ${styles.workspaceWide}` : styles.workspace}>
          <section data-tour="placecards.canvas" className={styles.pane} aria-label="Card">
            <h2 className={styles.paneTitle}>
              Card{hasBackSide(template) ? ` — ${editingSide}` : ""}
              {artefacts.length > 0 && (
                <span className={styles.paneMeta}>
                  {/* Scope decides what "one of these" means: a guest, a table, the lot. */}
                  {previewArtefact?.label} — {previewGuestIndex + 1} of {artefacts.length}
                </span>
              )}
              {cropId && <span className={styles.cropBadge}>Cropping — drag the artwork, Esc to finish</span>}
              <span className={styles.paneTools}>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, z / 1.25))}
                  disabled={zoom <= 1}
                  aria-label="Zoom out"
                >
                  −
                </button>
                <span className={styles.zoomValue}>{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(MAX_VIEW_ZOOM, z * 1.25))}
                  disabled={zoom >= MAX_VIEW_ZOOM}
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1}>
                  Fit
                </button>
              </span>
            </h2>
            <div className={styles.paneBody}>
              <CardCanvas
                card={card}
                template={editableTemplate}
                row={previewRow}
                rows={previewArtefact?.rows ?? [previewRow]}
                fonts={fonts}
                resolveOptions={resolveOptions}
                selectedId={selectedId}
                snapEnabled={snapEnabled}
                cropId={cropId}
                zoom={zoom}
                onSelect={select}
                onChange={setElementBox}
                onCrop={setElementCrop}
                onZoomChange={setZoom}
                onRequestCrop={setCropId}
              />
            </div>
            <Pagination
              index={previewGuestIndex}
              count={artefacts.length}
              onChange={setPreviewGuestIndex}
              noun={{ one: "Card", many: "Cards" }}
            />
          </section>

          {sheetCollapsed ? (
            <section className={styles.strip} aria-label="Sheet">
              <button
                type="button"
                className={styles.stripButton}
                onClick={toggleSheetCollapsed}
                aria-expanded={false}
              >
                Sheet
              </button>
            </section>
          ) : (
            <section className={styles.pane} aria-label="Sheet">
              <h2 className={styles.paneTitle}>
                Sheet
                <span className={styles.paneTools}>
                  <button type="button" onClick={toggleSheetCollapsed} aria-expanded>
                    Hide
                  </button>
                </span>
              </h2>
              <div className={styles.paneBody}>
                {currentSheet ? (
                  <SheetPreview sheet={currentSheet} fonts={fonts} className={styles.sheet} />
                ) : (
                  <p className={styles.empty}>Nothing to impose yet.</p>
                )}
              </div>
              <Pagination
                index={pageIndex}
                count={sheetCount}
                onChange={setPage}
                noun={{ one: "Sheet", many: "Sheets" }}
              />
            </section>
          )}
        </div>

        <RowsDrawer
          artefacts={artefacts}
          headroom={analysis.headroom}
          selectedIndex={previewGuestIndex}
          onSelect={setPreviewGuestIndex}
        />
        <MissingAssets missing={missing} />
        <WarningsList issues={issues} warnings={warnings} artefacts={artefacts} />
        <ExportBar
          sheetCount={sheetCount}
          issues={issues}
          artefacts={artefacts}
          warnings={warnings}
          missing={missing}
        />
      </div>
    </div>
  );
}
