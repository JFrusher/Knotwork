import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { defaultFoldPosition } from "../../core/geometry/fold";
import { computeLayout } from "../../core/geometry/pageLayout";
import { suggestLayouts } from "../../core/geometry/suggestLayouts";
import { STOCK_PRESETS, applyPreset } from "../../core/data/stockPresets";
import { CARD_PRESETS, applyCardPreset } from "../../core/data/cardPresets";
import type { Booklet, FoldAxis, Mm, Orientation, PageSizeName, PaperName } from "../../core/types";
import { MARK_LENGTH_MM } from "../../core/geometry/cropMarks";
import { usePlaque } from "../../state/store";
import { CheckboxField, Hint, NumberField, Row, SelectField, SubGroup } from "../controls";
import styles from "./GeometryPanel.module.css";

const uniformMargin = (mm: Mm) => ({
  marginTopMm: mm,
  marginRightMm: mm,
  marginBottomMm: mm,
  marginLeftMm: mm,
});

/**
 * FR-STA-02, the card half: any size, any fold.
 *
 * Card and Sheet were one component because they were one panel. They are two
 * module views now — the card is the artefact, the sheet is the press — so they
 * are two components, each subscribing to the slice it actually draws.
 */
export function CardPanel() {
  const { card, setCard } = usePlaque(
    useShallow((s) => ({
      card: s.card,
      setCard: s.setCard,
    })),
  );

  const foldSpan = card.fold === "vertical" ? card.widthMm : card.heightMm;

  return (
    <>
      <Hint>To start from a design, open Designs at the top.</Hint>

      <SelectField
        label="What are you making?"
        value=""
        options={[
          { value: "", label: "Custom size" },
          ...CARD_PRESETS.map((p) => ({ value: p.id, label: p.name })),
        ]}
        onChange={(id) => {
          const preset = CARD_PRESETS.find((p) => p.id === id);
          if (preset) setCard(applyCardPreset(preset));
        }}
      />
      <Hint>Presets set the size and the fold. Everything stays editable afterwards.</Hint>

      <SubGroup title="Size">
        <Row>
          <NumberField
            label="Width"
            value={card.widthMm}
            step={0.5}
            min={5}
            suffix="mm"
            onChange={(widthMm) => setCard({ widthMm })}
          />
          <NumberField
            label="Height"
            value={card.heightMm}
            step={0.5}
            min={5}
            suffix="mm"
            onChange={(heightMm) => setCard({ heightMm })}
          />
        </Row>
        <NumberField
          label="Bleed"
          value={card.bleedMm}
          step={0.5}
          min={0}
          suffix="mm"
          onChange={(bleedMm) => setCard({ bleedMm })}
        />
      </SubGroup>

      <SubGroup title="Fold">
        <Row>
          <SelectField<FoldAxis>
            label="Fold"
            value={card.fold}
            options={[
              { value: "none", label: "Flat card" },
              { value: "horizontal", label: "Tent (folds across)" },
              { value: "vertical", label: "Folds down the middle" },
            ]}
            onChange={(fold) => setCard({ fold })}
          />
          <NumberField
            label="Fold at"
            value={card.foldPositionMm}
            step={0.5}
            min={1}
            max={foldSpan - 1}
            suffix="mm"
            onChange={(foldPositionMm) => setCard({ foldPositionMm })}
          />
        </Row>

        {card.fold !== "none" && (
          <>
            <CheckboxField
              label="Rotate the back panel 180°"
              checked={card.invertBackPanel}
              disabled={card.fold === "vertical"}
              onChange={(invertBackPanel) => setCard({ invertBackPanel })}
              hint={
                card.fold === "vertical"
                  ? "A fold down the middle mirrors the back panel rather than rotating it."
                  : undefined
              }
            />
            <Hint>
              {card.fold === "vertical"
                ? "A fold down the middle turns the back panel into a mirror image, which no rotation can fix, so this does not apply."
                : "The editor shows both panels the right way up. The back one is rotated when the sheet is imposed, so it reads from across the table."}
            </Hint>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => setCard({ foldPositionMm: defaultFoldPosition(card) })}
            >
              Centre the fold
            </button>
          </>
        )}
      </SubGroup>
    </>
  );
}

/** FR-STA-02, the sheet half: what the press does with the card. */
export function SheetPanel() {
  const { card, sheet, setCard, setSheet, applySuggestion, booklet } = usePlaque(
    useShallow((s) => ({
      card: s.card,
      sheet: s.sheet,
      setCard: s.setCard,
      setSheet: s.setSheet,
      applySuggestion: s.applySuggestion,
      booklet: s.booklet,
    })),
  );

  const suggestions = useMemo(
    () => suggestLayouts(card, { printerMarginMm: sheet.printerMarginMm, maxResults: 4 }),
    [card, sheet.printerMarginMm],
  );
  const layout = useMemo(() => computeLayout(card, sheet), [card, sheet]);

  if (booklet) return <BookletSetup booklet={booklet} />;

  return (
    <>
      <SelectField
        label="Pre-cut stock"
        value=""
        options={[
          { value: "", label: "None — plain sheets, cut them yourself" },
          ...STOCK_PRESETS.map((p) => ({ value: p.id, label: p.name })),
        ]}
        onChange={(id) => {
          const preset = STOCK_PRESETS.find((p) => p.id === id);
          if (!preset) return;
          const applied = applyPreset(preset);
          setCard(applied.card);
          setSheet(applied.sheet);
        }}
      />
      <Hint>
        A preset sets the card size and the grid, and turns crop marks off — the cutting already
        happened. Prove it with "Two test cards" on plain paper held against the real sheet before
        feeding stock you paid for.
      </Hint>

      {sheet.page !== "FIT" && suggestions.length > 0 && (
        <SubGroup title="Fits best">
          <div className={styles.suggestions}>
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={
                  s.page === sheet.page &&
                  s.orientation === sheet.orientation &&
                  s.cardRotationDeg === sheet.cardRotationDeg
                    ? `${styles.suggestion} ${styles.active}`
                    : styles.suggestion
                }
                onClick={() => applySuggestion(s)}
              >
                <strong>{s.perSheet} per sheet</strong>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </SubGroup>
      )}

      <Row>
        <SelectField<PageSizeName>
          label="Paper"
          value={sheet.page}
          options={[
            { value: "A4", label: "A4" },
            { value: "LETTER", label: "US Letter" },
            { value: "A3", label: "A3" },
            { value: "FIT", label: "The card's own size" },
          ]}
          onChange={(page) =>
            setSheet(
              page === "FIT"
                ? // Room round the board for its bleed and crop marks, and nothing
                  // else: the print shop trims to the marks.
                  { page, ...uniformMargin(card.bleedMm + MARK_LENGTH_MM + 2), gapXMm: 0, gapYMm: 0, cardRotationDeg: 0 }
                : { page },
            )
          }
        />
        {sheet.page === "FIT" ? (
          <SelectField<PaperName>
            label="Tile at home on"
            value={sheet.tilePaper}
            options={[
              { value: "A4", label: "A4" },
              { value: "LETTER", label: "US Letter" },
              { value: "A3", label: "A3" },
            ]}
            onChange={(tilePaper) => setSheet({ tilePaper })}
          />
        ) : (
          <SelectField<Orientation>
            label="Orientation"
            value={sheet.orientation}
            options={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
            onChange={(orientation) => setSheet({ orientation })}
          />
        )}
      </Row>
      {sheet.page === "FIT" && (
        <Hint>
          One per page at full size, with its bleed and crop marks: the PDF a print shop wants. To
          print it yourself, tile it onto {sheet.tilePaper === "LETTER" ? "Letter" : sheet.tilePaper} from the
          export bar.
        </Hint>
      )}

      <CheckboxField
        label="Turn cards 90° on the sheet"
        checked={sheet.cardRotationDeg === 90}
        onChange={(on) => setSheet({ cardRotationDeg: on ? 90 : 0 })}
      />

      <SubGroup title="Margins and gaps" open={false}>
        <Row>
          <NumberField
            label="Margin top"
            value={sheet.marginTopMm}
            step={0.5}
            min={0}
            suffix="mm"
            onChange={(marginTopMm) => setSheet({ marginTopMm })}
          />
          <NumberField
            label="Margin bottom"
            value={sheet.marginBottomMm}
            step={0.5}
            min={0}
            suffix="mm"
            onChange={(marginBottomMm) => setSheet({ marginBottomMm })}
          />
        </Row>
        <Row>
          <NumberField
            label="Margin left"
            value={sheet.marginLeftMm}
            step={0.5}
            min={0}
            suffix="mm"
            onChange={(marginLeftMm) => setSheet({ marginLeftMm })}
          />
          <NumberField
            label="Margin right"
            value={sheet.marginRightMm}
            step={0.5}
            min={0}
            suffix="mm"
            onChange={(marginRightMm) => setSheet({ marginRightMm })}
          />
        </Row>
        <Row>
          <NumberField
            label="Gap across"
            value={sheet.gapXMm}
            step={0.5}
            min={0}
            suffix="mm"
            onChange={(gapXMm) => setSheet({ gapXMm })}
          />
          <NumberField
            label="Gap down"
            value={sheet.gapYMm}
            step={0.5}
            min={0}
            suffix="mm"
            onChange={(gapYMm) => setSheet({ gapYMm })}
          />
        </Row>
        <NumberField
          label="Printer's unprintable border"
          value={sheet.printerMarginMm}
          step={0.5}
          min={0}
          suffix="mm"
          onChange={(printerMarginMm) => setSheet({ printerMarginMm })}
        />
      </SubGroup>

      <Hint>
        {layout.perSheet > 0
          ? `${layout.cols} × ${layout.rows} — ${layout.perSheet} cards per sheet.`
          : "No cards fit at these settings."}
      </Hint>
    </>
  );
}

/**
 * A booklet is printed one of two ways: folded at home, two pages to a side,
 * or a page at a time with crop marks for a print shop to fold and trim.
 */
function BookletSetup({ booklet }: { booklet: Booklet }) {
  const setBooklet = usePlaque((s) => s.setBooklet);
  return (
    <>
      <SelectField<Booklet["output"]>
        label="Printed"
        value={booklet.output}
        options={[
          { value: "home", label: "At home — folded, two pages to a side" },
          { value: "shop", label: "By a print shop — a page each, with crop marks" },
        ]}
        onChange={(output) => setBooklet({ ...booklet, output })}
      />
      {booklet.output === "home" ? (
        <>
          <SelectField<PaperName>
            label="On"
            value={booklet.paper}
            options={[
              { value: "A4", label: "A4 — for A5 pages" },
              { value: "A3", label: "A3 — for A4 pages" },
              { value: "LETTER", label: "Letter — for half-letter pages" },
            ]}
            onChange={(paper) => setBooklet({ ...booklet, paper })}
          />
          <Hint>
            The pages are put in folding order. Print on both sides, turning over on the edge your printer is set to under
            Print setup, then fold the stack in half. Keep words 10mm from the edge: most home printers cannot reach it.
          </Hint>
        </>
      ) : (
        <Hint>Each page on its own, 3mm of bleed past its edges and crop marks outside them: what a print shop asks for.</Hint>
      )}
    </>
  );
}
