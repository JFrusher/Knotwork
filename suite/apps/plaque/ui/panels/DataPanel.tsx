import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { buildArtefacts } from "../../core/data/artefacts";
import type { RowScope } from "../../core/types";
import { usePlaque } from "../../state/store";
import { Hint, SelectField, SubGroup } from "../controls";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { guestName, readGuests } from "@/lib/model/slices";
import type { Guest } from "@/lib/model/types";
import { rowsFromRoom } from "../../state/fromRoom";
import styles from "./DataPanel.module.css";

const PER_ROW: RowScope = { kind: "per-row" };

function scopeValue(scope: RowScope): string {
  if (scope.kind === "per-group") return `group:${scope.byColumn}`;
  return scope.kind;
}

function parseScope(value: string): RowScope {
  if (value === "document") return { kind: "document" };
  if (value.startsWith("group:")) return { kind: "per-group", byColumn: value.slice(6) };
  return PER_ROW;
}

/** States the consequence in counts, because that is what the user is deciding. */
function scopeHint(scope: RowScope, rowCount: number, artefactCount: number): string {
  if (scope.kind === "per-row") return `${rowCount} rows, ${artefactCount} cards.`;
  if (scope.kind === "document") return `${rowCount} rows on one document.`;
  return `${rowCount} rows fall into ${artefactCount} groups by "${scope.byColumn}" — one artefact each.`;
}

/**
 * The guest list the cards print from: the room, all of it or a chosen few.
 *
 * There is no file import. A CSV exported before the last three people moved
 * prints three wrong tables and looks perfectly fine doing it; the room is
 * always current.
 */
export function DataPanel() {
  const { headers, rows, csvIssues, fileName, setCsv, rowScope, setRowScope } = usePlaque(
    useShallow((s) => ({
      headers: s.headers,
      rows: s.rows,
      csvIssues: s.csvIssues,
      fileName: s.fileName,
      setCsv: s.setCsv,
      rowScope: s.template.rowScope ?? PER_ROW,
      setRowScope: s.setRowScope,
    })),
  );
  // Counting is cheap and it is the only honest way to say what the scope did.
  const artefactCount = buildArtefacts(rows, rowScope, headers).length;
  // Subscribed to the shared wedding, not to Plaque's own store: seat someone
  // in the room next door and this list has to move. Read through the
  // per-document cache, so the selector returns the same record until the
  // document changes and never allocates.
  const roomGuests = useTrousseauStore((s) => readGuests(s.doc));
  const roomCount = Object.keys(roomGuests).length;

  return (
    <>
      {roomCount === 0 ? (
        <Hint>
          No guests yet. Add them in Seating, or import a list from the Data button, and they
          appear here.
        </Hint>
      ) : (
        <button
          type="button"
          data-tour="placecards.useroom"
          className={styles.button}
          onClick={() => setCsv(rowsFromRoom())}
          title="Take the guest list and table numbers from the seating plan"
        >
          Use the room — {roomCount} {roomCount === 1 ? "guest" : "guests"}
        </button>
      )}

      {roomCount > 0 && (
        <FewGuests guests={roomGuests} onUse={(ids) => setCsv(rowsFromRoom(ids))} />
      )}

      {fileName && (
        <Hint>
          {rows.length === roomCount
            ? `Printing all ${rows.length} guests from the room.`
            : `Printing ${rows.length} of the room's ${roomCount} guests.`}
        </Hint>
      )}

      {headers.length > 0 && (
        <>
          <SelectField
            label="Print one artefact per"
            value={scopeValue(rowScope)}
            options={[
              { value: "per-row", label: "Row — place cards, badges, tags" },
              ...headers.map((h) => ({ value: `group:${h}`, label: `Group by ${h} — menus, table cards` })),
              { value: "document", label: "The whole list — run-sheet, seating list" },
            ]}
            onChange={(value) => setRowScope(parseScope(value))}
          />
          <Hint>
            {scopeHint(rowScope, rows.length, artefactCount)}
          </Hint>
        </>
      )}

      {headers.length > 0 && (
        <SubGroup title={`Columns (${headers.length})`}>
          <div className={styles.tokens}>
            {headers.map((h) => (
              <code key={h} className={styles.token} title="Use this in any text element">
                {`{{${h}}}`}
              </code>
            ))}
          </div>
        </SubGroup>
      )}

      {csvIssues.length > 0 && (
        <details className={styles.issues}>
          <summary>
            {csvIssues.length} {csvIssues.length === 1 ? "row needs" : "rows need"} a look
          </summary>
          <ul>
            {csvIssues.slice(0, 20).map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
            {csvIssues.length > 20 && <li>…and {csvIssues.length - 20} more.</li>}
          </ul>
        </details>
      )}
    </>
  );
}

/**
 * Reprinting a handful — a misspelt name, a late change of table — without
 * running the whole list through the printer again.
 */
function FewGuests({
  guests,
  onUse,
}: {
  guests: Record<string, Guest>;
  onUse: (ids: ReadonlySet<string>) => void;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const everyone = useMemo(
    () =>
      Object.values(guests)
        .map((guest) => ({ id: guest.id, name: guestName(guest) }))
        .sort((a, b) => a.name.localeCompare(b.name, "en")),
    [guests],
  );
  const needle = query.trim().toLowerCase();
  const shown = needle ? everyone.filter((guest) => guest.name.toLowerCase().includes(needle)) : everyone;

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <SubGroup title="Reprint just a few" open={false}>
      <input
        type="search"
        className={styles.search}
        placeholder="Find a guest"
        aria-label="Find a guest"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul className={styles.picker} aria-label="Guests to print">
        {shown.map((guest) => (
          <li key={guest.id}>
            <label className={styles.pick}>
              <input type="checkbox" checked={chosen.has(guest.id)} onChange={() => toggle(guest.id)} />
              {guest.name || "Unnamed guest"}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.button}
        disabled={chosen.size === 0}
        onClick={() => onUse(chosen)}
      >
        {chosen.size === 0
          ? "Choose guests to print"
          : `Print just these ${chosen.size}`}
      </button>
    </SubGroup>
  );
}
