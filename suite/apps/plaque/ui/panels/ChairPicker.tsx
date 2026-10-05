import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { tokensIn } from "../../core/csv/interpolate";
import { normalise } from "../../core/data/artefacts";
import { chairName, chairRef, chairToken, type ChairRef } from "../../core/template/chairs";
import type { RoomTable } from "../../core/types";
import { usePlaque } from "../../state/store";
import { Field, Hint } from "../controls";
import { NameFormat } from "./NameFormat";
import styles from "./ChairPicker.module.css";

type Mode = "table" | "room";

/**
 * A text field whose chairs are picked on a map rather than typed: the
 * template, and under it the card's own table or the whole room, a click on a
 * chair putting its token where the cursor is.
 */
export function TemplateField({
  label,
  value,
  placeholder,
  cardTable,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  /** The table of the card on screen, for "this card's table". */
  cardTable: string;
  onChange: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const insert = (token: string) => {
    const field = input.current;
    const from = field?.selectionStart ?? value.length;
    const to = field?.selectionEnd ?? value.length;
    // A word of its own: a space before it when it would otherwise run on.
    const text = `${from > 0 && !/\s/.test(value[from - 1]!) ? " " : ""}{{${token}}}`;
    onChange(value.slice(0, from) + text + value.slice(to));
    // Back to the field, just after what went in, for the next word.
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(from + text.length, from + text.length);
    });
  };

  return (
    <>
      <Field label={label}>
        <input
          ref={input}
          type="text"
          className={styles.input}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
      <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Done picking" : "Pick a chair"}
      </button>
      {open && <ChairPicker template={value} cardTable={cardTable} onPick={insert} />}
    </>
  );
}

/**
 * The map: tables and their chairs, from the room as it stands. A chair at a
 * table that numbers its seats is a button; one where guests sit where they
 * like is not, and says why. Chairs this text already names are ringed.
 */
export function ChairPicker({
  template,
  cardTable,
  onPick,
}: {
  template: string;
  cardTable: string;
  onPick: (token: string) => void;
}) {
  const { room, design } = usePlaque(useShallow((s) => ({ room: s.room, design: s.template })));
  const own = useMemo(
    () => room.tables.find((t) => normalise(t.label) === normalise(cardTable)) ?? null,
    [room, cardTable],
  );
  const [mode, setMode] = useState<Mode>(own ? "table" : "room");
  const showing = mode === "table" && own ? [own] : room.tables;

  // Every chair this text names, by where it is.
  const used = useMemo(() => {
    const keys = new Set<string>();
    for (const token of tokensIn(template)) {
      const ref = chairRef(token);
      if (!ref) continue;
      const table = ref.table ?? own?.label ?? "";
      keys.add(`${normalise(table)}#${ref.seat}`);
    }
    return keys;
  }, [template, own]);

  const bounds = useMemo(() => boundsOf(showing, room.seatRadius), [showing, room.seatRadius]);
  const freeSeating = mode === "table" && own && !own.numbered;

  const pick = (table: RoomTable, seat: number) => {
    const ref: ChairRef = { table: mode === "table" ? null : table.label, seat };
    onPick(chairToken(ref));
  };

  return (
    <div className={styles.picker}>
      <div className={styles.modes} role="group" aria-label="Which chairs">
        <button
          type="button"
          aria-pressed={mode === "table"}
          disabled={!own}
          title={own ? undefined : "This card is not for a table."}
          onClick={() => setMode("table")}
        >
          This card's table
        </button>
        <button type="button" aria-pressed={mode === "room"} onClick={() => setMode("room")}>
          The room
        </button>
      </div>
      <Hint>
        {mode === "table"
          ? "Seat by seat on this card's table: every table's card fills in its own."
          : "One chair in the room: it says whoever sits there, on every card."}
      </Hint>

      {room.tables.length === 0 ? (
        <Hint>There is no seating plan yet. Add tables in Seating, and they appear here.</Hint>
      ) : (
        <svg
          className={styles.map}
          viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
          role="group"
          aria-label={mode === "table" && own ? `${own.label} and its chairs` : "The room and its chairs"}
        >
          {showing.map((table) => (
            <g key={table.label} className={table.numbered ? undefined : styles.free}>
              <path
                d={table.pathD}
                transform={`translate(${table.x} ${table.y}) rotate(${table.rotationDeg})`}
                className={styles.table}
              >
                <title>{table.numbered ? table.label : `${table.label}: guests sit where they like`}</title>
              </path>
              {table.seats.map((seat) => {
                const key = `${normalise(table.label)}#${seat.number}`;
                const who = seat.row ? chairName(design, seat.row) : "empty";
                const label = `${table.label}, seat ${seat.number}: ${who}`;
                const press = () => pick(table, seat.number);
                return table.numbered ? (
                  <circle
                    key={seat.number}
                    cx={seat.x}
                    cy={seat.y}
                    r={room.seatRadius}
                    role="button"
                    tabIndex={0}
                    aria-label={label}
                    className={used.has(key) ? `${styles.chair} ${styles.used}` : styles.chair}
                    onClick={press}
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        press();
                      }
                    }}
                  >
                    <title>{label}</title>
                  </circle>
                ) : (
                  <circle key={seat.number} cx={seat.x} cy={seat.y} r={room.seatRadius} className={styles.idle} />
                );
              })}
            </g>
          ))}
        </svg>
      )}

      {freeSeating && (
        <Hint>
          Guests at {own!.label} sit where they like, so its chairs have no names to pick. Number its seats in
          Seating, and they can be picked here.
        </Hint>
      )}
      <NameFormat />
    </div>
  );
}

/** What a set of tables and their chairs cover, with a chair's width to spare. */
function boundsOf(tables: RoomTable[], seatRadius: number) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const t of tables) {
    const reach = Math.hypot(t.view.w, t.view.h) / 2;
    xs.push(t.x - reach, t.x + reach, ...t.seats.map((s) => s.x));
    ys.push(t.y - reach, t.y + reach, ...t.seats.map((s) => s.y));
  }
  if (xs.length === 0) return { x: 0, y: 0, w: 1, h: 1 };
  const pad = seatRadius * 2;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}
