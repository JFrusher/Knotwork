import { useMemo, useState } from "react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import type { Artefact } from "../../core/data/artefacts";
import { artefactsOf } from "../../core/data/parts";
import type { RowScope } from "../../core/types";
import { printing } from "../../state/printed";
import { usePlaque } from "../../state/store";
import { Hint, SelectField, SubGroup } from "../controls";
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
function scopeHint(scope: RowScope, rowCount: number, artefacts: Artefact[]): string {
  if (scope.kind === "per-row") return `${rowCount} rows, ${artefacts.length} cards.`;
  if (scope.kind === "document") return `${rowCount} rows on one document.`;
  const grouped = `${rowCount} rows fall into ${artefacts.length} groups by "${scope.byColumn}" — one artefact each.`;
  const leftOut = rowCount - artefacts.reduce((n, a) => n + a.rows.length, 0);
  if (leftOut === 0) return grouped;
  return `${grouped} ${leftOut === 1 ? "One row has" : `${leftOut} rows have`} no ${scope.byColumn}, so ${leftOut === 1 ? "is" : "are"} on none.`;
}

/**
 * What this piece prints from: the room, live.
 *
 * There is no file import and nothing to press. A CSV exported before the last
 * three people moved prints three wrong tables and looks perfectly fine doing
 * it; the room is always current, and the cards are read from it as it changes.
 */
export function DataPanel() {
  const { template, headers, rows, rowIds, rowIssues, rowScope, setRowScope, printOnly, setPrintOnly, booklet } = usePlaque(
    useShallow((s) => ({
      booklet: s.booklet !== null,
      template: s.template,
      headers: s.headers,
      rows: s.rows,
      rowIds: s.rowIds,
      rowIssues: s.rowIssues,
      rowScope: s.template.rowScope ?? PER_ROW,
      setRowScope: s.setRowScope,
      printOnly: s.printOnly,
      setPrintOnly: s.setPrintOnly,
    })),
  );
  const artefacts = useMemo(() => artefactsOf(template, rows, headers, rowIds), [template, rows, headers, rowIds]);

  if (booklet) {
    return (
      <>
        <p className={styles.live}>
          Printing from Ceremony, as it stands: {rows.length} pages, folded. What the guests are told — the parts, the words,
          the music — is written there and is here at once.
        </p>
        <Link href="/ceremony" className={styles.button}>
          Change it in Ceremony
        </Link>
        <Columns headers={headers} />
      </>
    );
  }

  return (
    <>
      <p data-tour="placecards.room" className={styles.live}>
        {rows.length === 0
          ? "No guests yet. Add them in Seating, or import a list from the Data button, and they appear here."
          : `Printing from the room, as it stands: ${rows.length} ${rows.length === 1 ? "guest" : "guests"}. Seat someone and their card already knows.`}
      </p>

      {rows.length > 0 && (
        <>
          <SelectField
            label="Print one artefact per"
            value={scopeValue(rowScope)}
            options={[
              { value: "per-row", label: "Guest — place cards, escort cards, badges" },
              ...headers.map((h) => ({ value: `group:${h}`, label: `Group by ${h} — table cards, menus` })),
              { value: "document", label: "The whole list — a board, a seating list" },
            ]}
            onChange={(value) => setRowScope(parseScope(value))}
          />
          <Hint>{scopeHint(rowScope, rows.length, artefacts)}</Hint>
        </>
      )}

      {(artefacts.length > 1 || printOnly) && (
        <ReprintFew artefacts={artefacts} printOnly={printOnly} onChoose={setPrintOnly} />
      )}

      <Columns headers={headers} />

      {/* Grouped, the count above says who is on no card; these speak of a guest's own card. */}
      {rowIssues.length > 0 && rowScope.kind !== "per-group" && (
        <ul className={styles.issues}>
          {rowIssues.map((issue) => (
            <li key={issue.message}>{issue.message}</li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Reprinting a handful — a misspelt name, a late change of table — without
 * running the whole list through the printer again. Chosen by card rather than
 * by guest, so it works the same for a place card, a combined card or a table.
 */
function ReprintFew({
  artefacts,
  printOnly,
  onChoose,
}: {
  artefacts: Artefact[];
  printOnly: string[] | null;
  onChoose: (keys: string[] | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set(printOnly ?? []));
  const needle = query.trim().toLowerCase();
  const shown = needle ? artefacts.filter((a) => a.label.toLowerCase().includes(needle)) : artefacts;

  const toggle = (key: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (printOnly) {
    return (
      <div className={styles.only}>
        <Hint>
          The PDF will hold just {printing(artefacts, printOnly).length} of {artefacts.length}.
        </Hint>
        <button type="button" className={styles.button} onClick={() => onChoose(null)}>
          Print them all again
        </button>
      </div>
    );
  }

  return (
    <SubGroup title="Reprint just a few" open={false}>
      <input
        type="search"
        className={styles.search}
        placeholder="Find a card"
        aria-label="Find a card"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul className={styles.picker} aria-label="Cards to print">
        {shown.map((artefact) => (
          <li key={artefact.key}>
            <label className={styles.pick}>
              <input type="checkbox" checked={chosen.has(artefact.key)} onChange={() => toggle(artefact.key)} />
              {artefact.label}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.button}
        disabled={chosen.size === 0}
        onClick={() => onChoose(artefacts.filter((a) => chosen.has(a.key)).map((a) => a.key))}
      >
        {chosen.size === 0 ? "Choose cards to print" : `Print just these ${chosen.size}`}
      </button>
    </SubGroup>
  );
}

/** What a text element can say: each column as a token to type. */
function Columns({ headers }: { headers: string[] }) {
  return (
    <SubGroup title={`Columns (${headers.length})`}>
      <div className={styles.tokens}>
        {headers.map((h) => (
          <code key={h} className={styles.token} title="Use this in any text element">
            {`{{${h}}}`}
          </code>
        ))}
      </div>
    </SubGroup>
  );
}
