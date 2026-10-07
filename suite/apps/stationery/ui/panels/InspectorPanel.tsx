import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { artefactsOf } from "../../core/data/parts";
import { panelBounds, panelOf } from "../../core/geometry/fold";
import { boxAtNaturalSize, boxFittedTo, boxWithAspect, MAX_ZOOM } from "../../core/template/imageFit";
import { templateForRow, type ElementPatch } from "../../core/template/overrides";
import { placeChairs } from "../../core/template/room";
import { DEFAULT_OPTICAL, NOTABLE_FEATURES, availableFeatures } from "../../core/text/optical";
import type { LoadedFont } from "../../core/text/measure";
import type {
  CardElement,
  FitMode,
  HAlign,
  ImageFit,
  GridElement,
  ListElement,
  PageRole,
  RoomElement,
  ServiceElement,
  ServiceStyle,
  ShrinkAnchor,
  TextElement,
  VAlign,
} from "../../core/types";
import { useStationery } from "../../state/store";
import { NameFormat } from "./NameFormat";
import { TemplateField } from "./ChairPicker";
import { StampChairs } from "./StampChairs";
import {
  CheckboxField,
  ColorField,
  Hint,
  NumberField,
  Row,
  SelectField,
  SubGroup,
  TextField,
} from "../controls";
import styles from "./InspectorPanel.module.css";

/**
 * Properties of the selected element.
 *
 * Every canvas gesture has a numeric equivalent here. The drag is the
 * convenience; these numbers are the truth, and they are the only way to place
 * something to a tenth of a millimetre.
 */
export function InspectorPanel() {
  const {
    element: raw,
    headers,
    fonts,
    fontLabels,
    updateElement,
    overrideForRow,
    template,
    rowId,
    rowLabel,
    cardTable,
    previewRow,
    room,
    card,
    images,
    cropId,
    setCropId,
    booklet,
  } = useStationery(
    useShallow((s) => {
      const artefacts = artefactsOf(s.template, s.rows, s.headers, s.rowIds);
      const artefact = artefacts[s.previewGuestIndex] ?? artefacts[0] ?? null;
      return {
        // The effective element: what this artefact actually prints, so the
        // numbers in the panel are the numbers on the card.
        element: templateForRow(s.template, artefact?.rowId ?? "").elements.find(
          (el) => el.id === s.selectedId,
        ),
        headers: s.headers,
        fonts: s.fonts,
        fontLabels: s.fontLabels,
        updateElement: s.updateElement,
        overrideForRow: s.overrideForRow,
        template: s.template,
        rowId: artefact?.rowId ?? null,
        rowLabel: artefact?.label ?? "",
        // A whole-list piece is one card for every table, so it has no table of its own.
        cardTable: s.template.rowScope?.kind === "document" ? "" : (artefact?.row["Table"] ?? ""),
        previewRow: artefact?.row ?? null,
        room: s.room,
        card: s.card,
        images: s.images,
        cropId: s.cropId,
        setCropId: s.setCropId,
        booklet: s.booklet !== null,
      };
    }),
  );
  const [rowOnly, setRowOnly] = useState(false);
  // A box that follows a chair, shown where it prints on the card on screen.
  const element = useMemo(() => {
    if (!raw || raw.kind !== "text" || !raw.chair?.follow) return raw;
    const own = { ...template, elements: template.elements.map((el) => (el.id === raw.id ? raw : el)) };
    return placeChairs(own, room, previewRow ?? {}).elements.find((el) => el.id === raw.id);
  }, [raw, template, room, previewRow]);

  if (!element) {
    return <Hint>Click something on the card to edit it.</Hint>;
  }

  const patch = (p: Partial<CardElement>) =>
    // The same edits, aimed at one row or at the design (D1). Everything below
    // is written once and routed here, so nothing can be editable in one mode
    // and mysteriously missing in the other.
    rowOnly && rowId
      ? overrideForRow(rowId, element.id, p as ElementPatch)
      : updateElement(element.id, p);

  const overridden = Boolean(rowId && template.overrides?.[rowId]?.[element.id]);

  return (
    <>
      {rowId && (
        <div className={styles.scope}>
          <CheckboxField
            label={`Just this one: ${rowLabel}`}
            checked={rowOnly}
            onChange={setRowOnly}
            hint="Edits apply to this artefact alone, as a patch over the design."
          />
          {overridden && (
            <button
              type="button"
              className={styles.clear}
              onClick={() => overrideForRow(rowId, element.id, null)}
            >
              Reset this element to the design
            </button>
          )}
        </div>
      )}
      {booklet && <PageProperties element={element} patch={patch} />}

      <SubGroup title="Position and size">
        <Row>
          <NumberField label="X" value={element.x} step={0.5} suffix="mm" onChange={(x) => patch({ x })} />
          <NumberField label="Y" value={element.y} step={0.5} suffix="mm" onChange={(y) => patch({ y })} />
        </Row>
        <Row>
          <NumberField
            label="Width"
            value={element.w}
            step={0.5}
            min={1}
            suffix="mm"
            onChange={(w) => patch({ w })}
          />
          <NumberField
            label="Height"
            value={element.h}
            step={0.5}
            min={1}
            suffix="mm"
            onChange={(h) => patch({ h })}
          />
        </Row>
      </SubGroup>

      {element.kind === "text" && (
        <TextProperties
          element={element}
          headers={headers}
          cardTable={cardTable}
          fontOptions={[...fonts.keys()].map((id) => ({ value: id, label: fontLabels[id] ?? id }))}
          fonts={fonts}
          patch={patch}
        />
      )}

      {element.kind === "list" && (
        <ListProperties
          element={element}
          headers={headers}
          cardTable={cardTable}
          fontOptions={[...fonts.keys()].map((id) => ({ value: id, label: fontLabels[id] ?? id }))}
          fonts={fonts}
          patch={patch}
        />
      )}

      {element.kind === "service" && (
        <ServiceProperties
          element={element}
          fontOptions={[...fonts.keys()].map((id) => ({ value: id, label: fontLabels[id] ?? id }))}
          patch={patch}
        />
      )}

      {element.kind === "grid" && (
        <GridProperties
          element={element}
          headers={headers}
          fontOptions={[...fonts.keys()].map((id) => ({ value: id, label: fontLabels[id] ?? id }))}
          patch={patch}
        />
      )}

      {element.kind === "qr" && (
        <SubGroup title="QR code">
          <TextField
            label="Points at"
            value={element.data}
            placeholder="{{Guest Link}}"
            onChange={(data) => patch({ data })}
          />
          <Hint>
            {"{{Guest Link}}"} is the wedding's guest link — names and tables only — once it is published from
            the Data menu. Anything else typed here, a website or a gift list, works as well. Keep it dark on a
            light card, and at least 2cm across.
          </Hint>
          <ColorField label="Colour" value={element.colorHex} onChange={(c) => patch({ colorHex: c ?? "#000000" })} />
        </SubGroup>
      )}

      {element.kind === "room" && (
        <RoomProperties
          element={element}
          fontOptions={[...fonts.keys()].map((id) => ({ value: id, label: fontLabels[id] ?? id }))}
          patch={patch}
        />
      )}

      {element.kind === "icon" && (
        <SubGroup title="Icon">
          <SelectField
            label="Read from column"
            value={element.sourceField}
            options={[
              { value: "", label: headers.length ? "Choose a column" : "Upload a CSV first" },
              ...headers.map((h) => ({ value: h, label: h })),
            ]}
            onChange={(sourceField) => patch({ sourceField })}
          />
          <ColorField label="Colour" value={element.colorHex} onChange={(c) => patch({ colorHex: c ?? "#000000" })} />
          <Hint>Which icon appears for each value is set under Icon rules.</Hint>
        </SubGroup>
      )}

      {element.kind === "image" &&
        (() => {
          const source = element.imageId ? images.get(element.imageId) : undefined;
          const aspect = source ? source.naturalW / source.naturalH : null;
          const box = { x: element.x, y: element.y, w: element.w, h: element.h };
          // A tent card's panel, not the whole card: fitting across the crease
          // is never what "fit" means on a folded card.
          const panel = panelBounds(panelOf(box, card), card);
          const wholeCard = { x: 0, y: 0, w: card.widthMm, h: card.heightMm };
          // Stretch has no shape to keep, so a fit action fills the bounds.
          const shape = element.fit === "stretch" ? null : aspect;
          const cropping = cropId === element.id;

          return (
            <SubGroup title="Artwork">
              <SelectField<ImageFit>
                label="Fit"
                value={element.fit}
                options={[
                  { value: "contain", label: "Fit inside, keep shape" },
                  { value: "cover", label: "Fill the box, crop the rest" },
                  { value: "stretch", label: "Stretch to the box" },
                ]}
                onChange={(fit) => {
                  patch({ fit });
                  if (fit !== "cover" && cropping) setCropId(null);
                }}
              />

              {element.fit === "cover" && (
                <>
                  <NumberField
                    label="Crop zoom"
                    value={element.zoom ?? 1}
                    step={0.1}
                    min={1}
                    max={MAX_ZOOM}
                    onChange={(zoom) =>
                      patch({ zoom: Math.max(1, Math.min(MAX_ZOOM, zoom)) })
                    }
                  />
                  <button
                    type="button"
                    className={styles.action}
                    disabled={!source}
                    onClick={() => setCropId(cropping ? null : element.id)}
                  >
                    {cropping ? "Finish cropping" : "Crop"}
                  </button>
                  <Hint>
                    {cropping
                      ? "Drag the artwork to choose what shows. The wheel zooms. Esc finishes."
                      : "Or double-click the image on the card."}
                  </Hint>
                </>
              )}

              <NumberField
                label="Opacity"
                value={element.opacity}
                step={0.05}
                min={0}
                max={1}
                onChange={(opacity) => patch({ opacity: Math.max(0, Math.min(1, opacity)) })}
              />

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => patch(boxFittedTo(wholeCard, shape))}
                >
                  Fit to card
                </button>
                {card.fold !== "none" && (
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => patch(boxFittedTo(panel, shape))}
                  >
                    Fit to panel
                  </button>
                )}
                <button
                  type="button"
                  className={styles.action}
                  disabled={!aspect}
                  onClick={() => aspect && patch(boxWithAspect(box, aspect))}
                >
                  Match artwork shape
                </button>
                <button
                  type="button"
                  className={styles.action}
                  disabled={!source}
                  onClick={() =>
                    source &&
                    patch(
                      boxAtNaturalSize(box, { w: source.naturalW, h: source.naturalH }, wholeCard),
                    )
                  }
                >
                  Natural size
                </button>
              </div>

              <Hint>
                {element.imageId
                  ? "Change the artwork under Images."
                  : "Upload artwork under Images."}
              </Hint>
            </SubGroup>
          );
        })()}

      {(element.kind === "rect" || element.kind === "line") && (
        <SubGroup title="Fill and stroke">
          {element.kind === "rect" && (
            <ColorField label="Fill" value={element.fillHex} allowNone onChange={(fillHex) => patch({ fillHex })} />
          )}
          <ColorField
            label="Line colour"
            value={element.kind === "rect" ? element.strokeHex : element.strokeHex}
            allowNone={element.kind === "rect"}
            onChange={(strokeHex) => patch({ strokeHex: strokeHex ?? "#000000" })}
          />
          <Row>
            <NumberField
              label="Line width"
              value={element.strokeWidthMm}
              step={0.1}
              min={0}
              suffix="mm"
              onChange={(strokeWidthMm) => patch({ strokeWidthMm })}
            />
            <CheckboxField label="Dashed" checked={element.dashed} onChange={(dashed) => patch({ dashed })} />
          </Row>
        </SubGroup>
      )}
    </>
  );
}

/**
 * Where on a booklet an element is: which of its pages, and on the inside,
 * every page or only some — a photograph on page 3, a border on them all.
 */
function PageProperties({ element, patch }: { element: CardElement; patch: (p: Partial<CardElement>) => void }) {
  const role = element.page ?? "inside";
  return (
    <SubGroup title="On the booklet">
      <SelectField<PageRole>
        label="Page"
        value={role}
        options={[
          { value: "cover", label: "The cover" },
          { value: "inside", label: "The inside pages" },
          { value: "back", label: "The back" },
        ]}
        onChange={(page) => patch({ page, onPages: [] })}
      />
      {role === "inside" && <PagesField value={element.onPages ?? []} onChange={(onPages) => patch({ onPages })} />}
    </SubGroup>
  );
}

/** Page numbers as typed, "3, 5": kept when the field is left, so a half-typed list is not fought. */
function PagesField({ value, onChange }: { value: number[]; onChange: (pages: number[]) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (text: string) => {
    setDraft(null);
    onChange([...new Set(text.split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b));
  };
  return (
    <>
      <label className={styles.pages}>
        <span>Only on pages</span>
        <input
          type="text"
          inputMode="numeric"
          value={draft ?? value.join(", ")}
          placeholder="Every inside page"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
      <Hint>Leave it empty for every inside page. To change one page alone, tick &ldquo;Just this one&rdquo; above.</Hint>
    </>
  );
}

/** The order of service's type: its titles, its details, its words, each in its own face. */
function ServiceProperties({
  element,
  fontOptions,
  patch,
}: {
  element: ServiceElement;
  fontOptions: Array<{ value: string; label: string }>;
  patch: (p: Partial<CardElement>) => void;
}) {
  const style = (key: "heading" | "detail" | "words", title: string) => {
    const current: ServiceStyle = element[key];
    const set = (change: Partial<ServiceStyle>) => patch({ [key]: { ...current, ...change } } as Partial<CardElement>);
    return (
      <SubGroup title={title}>
        <SelectField label="Font" value={current.fontId} options={fontOptions} onChange={(fontId) => set({ fontId })} />
        <Row>
          <NumberField label="Size" value={current.fontSizePt} step={0.5} min={5} suffix="pt" onChange={(fontSizePt) => set({ fontSizePt })} />
          <ColorField label="Colour" value={current.colorHex} onChange={(c) => set({ colorHex: c ?? "#000000" })} />
        </Row>
      </SubGroup>
    );
  };
  return (
    <>
      <Hint>
        The ceremony as Ceremony tells the guests it, carrying on onto the next inside page when the box is full. What it says —
        the words, the lyrics, a note to stand — is chosen in Ceremony.
      </Hint>
      {style("heading", "Each part's title")}
      {style("detail", "Whose words, who leads it, the music")}
      {style("words", "Readings, vows and lyrics")}
      <SelectField
        label="Everyone's lines in responses"
        value={element.congregationFontId}
        options={fontOptions}
        onChange={(congregationFontId) => patch({ congregationFontId })}
      />
      <SubGroup title="Layout">
        <SelectField<HAlign>
          label="Align"
          value={element.align}
          options={[
            { value: "center", label: "Centred" },
            { value: "left", label: "Left" },
            { value: "right", label: "Right" },
          ]}
          onChange={(align) => patch({ align })}
        />
        <Row>
          <NumberField label="Line height" value={element.lineHeight} step={0.05} min={0.8} onChange={(lineHeight) => patch({ lineHeight })} />
          <NumberField label="Between parts" value={element.gapMm} step={0.5} min={0} suffix="mm" onChange={(gapMm) => patch({ gapMm })} />
        </Row>
        <Hint>Prose and responses are always set from the left, so they read as paragraphs.</Hint>
      </SubGroup>
    </>
  );
}

/**
 * A list is one line per row of whatever this artefact covers — the menu for a
 * table, the run-sheet for the whole event. Its typography controls are the
 * text ones; only the binding and the fit differ, so it reuses them.
 */
/** The room to scale from the seating plan, or one table of it. */
function RoomProperties({
  element,
  fontOptions,
  patch,
}: {
  element: RoomElement;
  fontOptions: Array<{ value: string; label: string }>;
  patch: (p: Partial<CardElement>) => void;
}) {
  return (
    <>
      <SelectField<RoomElement["show"]>
        label="Show"
        value={element.show}
        options={[
          { value: "room", label: "The whole room" },
          { value: "table", label: "Just this card's table" },
        ]}
        onChange={(show) => patch({ show })}
      />
      <NameFormat />
      <StampChairs element={element} />
      <Hint>
        Drawn from Seating as it stands: move a table or a guest there and it moves here. Where a table
        numbers its seats, each name sits at its chair, every one at the same size; where guests sit
        where they like, they are named inside the table, as Seating shows them.
      </Hint>
      <Row>
        <CheckboxField label="Table names" checked={element.tableLabels} onChange={(tableLabels) => patch({ tableLabels })} />
        <CheckboxField label="Walls" checked={element.walls} onChange={(walls) => patch({ walls })} />
      </Row>
      <CheckboxField
        label="Names at chairs"
        checked={element.namesAtChairs}
        onChange={(namesAtChairs) => patch({ namesAtChairs })}
        hint="Off once the names are boxes of their own, so they are not printed twice."
      />

      <SubGroup title="Typography">
        <SelectField label="Font" value={element.fontId} options={fontOptions} onChange={(fontId) => patch({ fontId })} />
        <Row>
          <NumberField
            label="Largest name"
            value={element.fontSizePt}
            step={0.5}
            min={1}
            suffix="pt"
            onChange={(fontSizePt) => patch({ fontSizePt })}
          />
          <NumberField
            label="Gap from the chair"
            value={element.nameGap}
            step={0.1}
            min={0}
            suffix="× chair"
            onChange={(nameGap) => patch({ nameGap: Math.max(0, nameGap) })}
          />
        </Row>
        <ColorField label="Names" value={element.colorHex} onChange={(c) => patch({ colorHex: c ?? "#000000" })} />
      </SubGroup>

      <SubGroup title="Colours">
        <ColorField label="Tables" value={element.tableHex} onChange={(c) => patch({ tableHex: c ?? "#e8dfcf" })} />
        <ColorField label="Chairs" value={element.seatHex} onChange={(c) => patch({ seatHex: c ?? "#c9b48f" })} />
        <ColorField label="Walls" value={element.wallHex} onChange={(c) => patch({ wallHex: c ?? "#7a6a55" })} />
      </SubGroup>
    </>
  );
}

/** A block per table, in columns: what makes a seating board. */
function GridProperties({
  element,
  headers,
  fontOptions,
  patch,
}: {
  element: GridElement;
  headers: string[];
  fontOptions: Array<{ value: string; label: string }>;
  patch: (p: Partial<CardElement>) => void;
}) {
  return (
    <>
      <SelectField<GridElement["layout"]>
        label="Lay it out as"
        value={element.layout}
        options={[
          { value: "cells", label: "A block each, all one size — a seating board" },
          { value: "columns", label: "Columns, onto more pages if need be — a finder" },
        ]}
        onChange={(layout) => patch({ layout })}
      />
      <SelectField
        label="A block for each"
        value={element.groupBy}
        options={headers.map((h) => ({ value: h, label: h }))}
        onChange={(groupBy) => patch({ groupBy })}
      />
      <SelectField
        label="Lines in order of"
        value={element.sortBy}
        options={[{ value: "", label: "As the room lists them" }, ...headers.map((h) => ({ value: h, label: h }))]}
        onChange={(sortBy) => patch({ sortBy })}
      />
      <TextField
        label="Heading"
        value={element.headingTemplate}
        placeholder="{{Table}}"
        onChange={(headingTemplate) => patch({ headingTemplate })}
      />
      <TextField
        label="One line per guest"
        value={element.itemTemplate}
        placeholder="{{Name}}"
        onChange={(itemTemplate) => patch({ itemTemplate })}
      />
      <Hint>
        {element.layout === "cells"
          ? "Every block shares one size, set as large as the fullest block allows."
          : "Blocks run down each column at the size set below; a list too long for the page carries on onto the next."}{" "}
        Somebody with no {element.groupBy || "value"} is left off, and the warnings say how many.
      </Hint>

      <SubGroup title="Layout">
        <Row>
          <NumberField
            label="Columns"
            value={element.columns}
            step={1}
            min={1}
            onChange={(columns) => patch({ columns: Math.max(1, Math.round(columns)) })}
          />
          <NumberField
            label="Gap"
            value={element.gapMm}
            step={1}
            min={0}
            suffix="mm"
            onChange={(gapMm) => patch({ gapMm })}
          />
        </Row>
      </SubGroup>

      <SubGroup title="Typography">
        <SelectField
          label="Heading font"
          value={element.headingFontId}
          options={fontOptions}
          onChange={(headingFontId) => patch({ headingFontId })}
        />
        <Row>
          <NumberField
            label="Heading size"
            value={element.headingScale}
            step={0.1}
            min={0.5}
            suffix="×"
            onChange={(headingScale) => patch({ headingScale })}
          />
          <ColorField
            label="Heading colour"
            value={element.headingColorHex}
            onChange={(c) => patch({ headingColorHex: c ?? "#000000" })}
          />
        </Row>
        <SelectField label="Font" value={element.fontId} options={fontOptions} onChange={(fontId) => patch({ fontId })} />
        <Row>
          <NumberField
            label="Size"
            value={element.fontSizePt}
            step={0.5}
            min={1}
            suffix="pt"
            onChange={(fontSizePt) => patch({ fontSizePt })}
          />
          <NumberField
            label="Smallest"
            value={element.fit.minFontSizePt}
            step={0.5}
            min={1}
            suffix="pt"
            onChange={(minFontSizePt) => patch({ fit: { ...element.fit, minFontSizePt } })}
          />
        </Row>
        <Row>
          <NumberField
            label="Line height"
            value={element.lineHeight}
            step={0.05}
            min={0.5}
            onChange={(lineHeight) => patch({ lineHeight })}
          />
          <SelectField<HAlign>
            label="Align"
            value={element.align}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Centre" },
              { value: "right", label: "Right" },
            ]}
            onChange={(align) => patch({ align })}
          />
        </Row>
        <ColorField label="Colour" value={element.colorHex} onChange={(c) => patch({ colorHex: c ?? "#000000" })} />
      </SubGroup>
    </>
  );
}

function ListProperties({
  element,
  headers,
  cardTable,
  fontOptions,
  fonts,
  patch,
}: {
  element: ListElement;
  headers: string[];
  cardTable: string;
  fontOptions: Array<{ value: string; label: string }>;
  fonts: Map<string, LoadedFont>;
  patch: (p: Partial<CardElement>) => void;
}) {
  return (
    <>
      <TemplateField
        label="One line per row"
        value={element.itemTemplate}
        placeholder="{{First Name}} — {{Meal}}"
        cardTable={cardTable}
        onChange={(itemTemplate) => patch({ itemTemplate })}
      />
      <Hint>
        {headers.length > 0
          ? `Repeats for every row this artefact covers. With per-group scope that is one table; with document scope, the whole list.`
          : "Upload a CSV, then set the row scope under Guest list."}
      </Hint>

      <SubGroup title="Typography">
      <Row>
        <TextField
          label="Bullet"
          value={element.bullet}
          placeholder="•"
          onChange={(bullet) => patch({ bullet })}
        />
        <CheckboxField
          label="Skip empty rows"
          checked={element.skipEmpty}
          onChange={(skipEmpty) => patch({ skipEmpty })}
          hint="A row whose line comes out blank is dropped rather than printed as a gap."
        />
      </Row>

      <SelectField label="Font" value={element.fontId} options={fontOptions} onChange={(fontId) => patch({ fontId })} />

      <Row>
        <NumberField
          label="Size"
          value={element.fontSizePt}
          step={0.5}
          min={1}
          suffix="pt"
          onChange={(fontSizePt) => patch({ fontSizePt })}
        />
        <NumberField
          label="Line height"
          value={element.lineHeight}
          step={0.05}
          min={0.5}
          onChange={(lineHeight) => patch({ lineHeight })}
        />
      </Row>

      <Row>
        <SelectField<HAlign>
          label="Align"
          value={element.align}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Centre" },
            { value: "right", label: "Right" },
          ]}
          onChange={(align) => patch({ align })}
        />
        <SelectField<VAlign>
          label="Vertically"
          value={element.vAlign}
          options={[
            { value: "top", label: "Top" },
            { value: "middle", label: "Middle" },
            { value: "bottom", label: "Bottom" },
          ]}
          onChange={(vAlign) => patch({ vAlign })}
        />
      </Row>

      <ColorField label="Colour" value={element.colorHex} onChange={(c) => patch({ colorHex: c ?? "#000000" })} />
      </SubGroup>

      <OpticalProperties element={element} patch={patch} fonts={fonts} />

      <SubGroup title="If it does not fit">
      <Row>
        <NumberField
          label="Never below"
          value={element.fit.minFontSizePt}
          step={0.5}
          min={1}
          suffix="pt"
          onChange={(minFontSizePt) => patch({ fit: { ...element.fit, minFontSizePt } })}
        />
        <SelectField<FitMode>
          label="If it does not fit"
          value={element.fit.mode === "none" ? "none" : "shrink"}
          options={[
            { value: "shrink", label: "Shrink the whole block" },
            { value: "none", label: "Leave it and warn me" },
          ]}
          onChange={(mode) => patch({ fit: { ...element.fit, mode } })}
        />
      </Row>
      <Hint>
        Lines are never re-wrapped — a wrapped menu line reads as two guests. The block shrinks until
        every line fits, then warns.
      </Hint>
      </SubGroup>
    </>
  );
}

/**
 * E1 — the difference between "printed at home" and "bought". All of it is
 * fontkit metrics applied in core/text/optical; nothing here does any layout.
 */
function OpticalProperties({
  element,
  patch,
  fonts,
}: {
  element: TextElement | ListElement;
  patch: (p: Partial<CardElement>) => void;
  fonts: Map<string, LoadedFont>;
}) {
  const optical = element.optical ?? DEFAULT_OPTICAL;
  const font = fonts.get(element.fontId);
  const features = font ? availableFeatures(font) : [];
  const notable = NOTABLE_FEATURES.filter((f) => features.includes(f));
  const set = (next: Partial<typeof optical>) =>
    patch({ optical: { ...optical, ...next } });

  return (
    <SubGroup title="Optical" open={false}>
      <CheckboxField
        label="Optical centring"
        checked={optical.opticalAlign}
        onChange={(opticalAlign) => set({ opticalAlign })}
        hint="Centre by the ink rather than the advance width, so a name ending in a full stop still looks centred."
      />
      <CheckboxField
        label="Hanging punctuation"
        checked={optical.hangingPunctuation}
        onChange={(hangingPunctuation) => set({ hangingPunctuation })}
        hint="Let a leading or trailing quote or dash sit outside the measure, so the letters stay aligned."
      />
      {notable.length > 0 && (
        <>
          <div className={styles.features}>
            {notable.map((feature) => {
              // null means "the font's own defaults"; the first switch pins the
              // whole set so what is on and off is explicit from then on.
              const active = optical.features ?? [...notable];
              const on = active.includes(feature);
              return (
                <button
                  key={feature}
                  type="button"
                  className={on ? `${styles.feature} ${styles.featureOn}` : styles.feature}
                  onClick={() =>
                    set({
                      features: on ? active.filter((f) => f !== feature) : [...active, feature],
                    })
                  }
                >
                  {feature}
                </button>
              );
            })}
          </div>
          <Hint>
            OpenType features this face offers. Turn "liga" off for a name its ligatures mangle.
          </Hint>
        </>
      )}
    </SubGroup>
  );
}

function TextProperties({
  element,
  headers,
  cardTable,
  fontOptions,
  fonts,
  patch,
}: {
  element: TextElement;
  headers: string[];
  cardTable: string;
  fontOptions: Array<{ value: string; label: string }>;
  fonts: Map<string, LoadedFont>;
  patch: (p: Partial<CardElement>) => void;
}) {
  return (
    <>
      <TemplateField
        label="Text"
        value={element.template}
        placeholder="{{First Name}}"
        cardTable={cardTable}
        onChange={(template) => patch({ template })}
      />
      {headers.length > 0 && (
        <Hint>
          Insert a column with double braces, e.g. <code>{"{{"}{headers[0]}{"}}"}</code>.
        </Hint>
      )}

      <SubGroup title="Typography">
      <SelectField label="Font" value={element.fontId} options={fontOptions} onChange={(fontId) => patch({ fontId })} />

      <Row>
        <NumberField
          label="Size"
          value={element.fontSizePt}
          step={0.5}
          min={1}
          suffix="pt"
          onChange={(fontSizePt) => patch({ fontSizePt })}
        />
        <NumberField
          label="Line height"
          value={element.lineHeight}
          step={0.05}
          min={0.5}
          onChange={(lineHeight) => patch({ lineHeight })}
        />
      </Row>

      <Row>
        <SelectField<HAlign>
          label="Align"
          value={element.align}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Centre" },
            { value: "right", label: "Right" },
          ]}
          onChange={(align) => patch({ align })}
        />
        <SelectField<VAlign>
          label="Vertically"
          value={element.vAlign}
          options={[
            { value: "top", label: "Top" },
            { value: "middle", label: "Middle" },
            { value: "bottom", label: "Bottom" },
          ]}
          onChange={(vAlign) => patch({ vAlign })}
        />
      </Row>

      <Row>
        <NumberField
          label="Letter spacing"
          value={element.letterSpacingMm}
          step={0.05}
          suffix="mm"
          onChange={(letterSpacingMm) => patch({ letterSpacingMm })}
        />
        <ColorField label="Colour" value={element.colorHex} onChange={(c) => patch({ colorHex: c ?? "#000000" })} />
      </Row>
      </SubGroup>

      <OpticalProperties element={element} patch={patch} fonts={fonts} />

      <SubGroup title="If it does not fit">
      <SelectField<FitMode>
        label="If it does not fit"
        value={element.fit.mode}
        options={[
          { value: "shrink", label: "Shrink to fit" },
          { value: "wrap", label: "Wrap onto more lines" },
          { value: "shrink-then-wrap", label: "Wrap, then shrink" },
          { value: "none", label: "Leave it and warn me" },
        ]}
        onChange={(mode) => patch({ fit: { ...element.fit, mode } })}
      />

      <SelectField<ShrinkAnchor>
        label="Shrink around"
        value={element.fit.anchor}
        options={[
          { value: "align", label: "Wherever it is aligned" },
          { value: "left", label: "Its left edge" },
          { value: "center", label: "Its centre" },
          { value: "right", label: "Its right edge" },
        ]}
        onChange={(anchor) => patch({ fit: { ...element.fit, anchor } })}
      />

      <Row>
        <NumberField
          label="Never below"
          value={element.fit.minFontSizePt}
          step={0.5}
          min={1}
          suffix="pt"
          onChange={(minFontSizePt) => patch({ fit: { ...element.fit, minFontSizePt } })}
        />
        <NumberField
          label="Max lines"
          value={element.fit.maxLines}
          step={1}
          min={1}
          onChange={(maxLines) => patch({ fit: { ...element.fit, maxLines } })}
        />
      </Row>

      <Hint>
        {element.fit.anchor === "align"
          ? "Text shrinks around wherever it is aligned, so a centred name stays centred and a right-aligned one keeps its right edge."
          : "Align decides how the lines sit relative to each other; this decides where the whole block sits as it shrinks."}
      </Hint>
      </SubGroup>
    </>
  );
}
