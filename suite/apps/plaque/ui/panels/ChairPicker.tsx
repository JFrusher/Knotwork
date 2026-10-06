import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { tokensIn } from "../../core/csv/interpolate";
import { normalise } from "../../core/data/artefacts";
import { chairName, chairRef, chairToken, type ChairRef } from "../../core/template/chairs";
import type { RoomTable } from "../../core/types";
import { usePlaque } from "../../state/store";
import { Field, Hint, SelectField } from "../controls";
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
  /** The table of the card on screen, for "this card's table"; empty when the card is for no one table. */
  cardTable: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Where a picked chair goes: the caret as the field last had it. Picking
  // leaves focus on the map, so the next chair is one key away.
  const caret = useRef<{ from: number; to: number } | null>(null);
  const remember = (field: HTMLInputElement) => {
    caret.current = { from: field.selectionStart ?? field.value.length, to: field.selectionEnd ?? field.value.length };
  };

  const insert = (token: string) => {
    const { from, to } = caret.current ?? { from: value.length, to: value.length };
    // A word of its own: a space before it when it would otherwise run on.
    const text = `${from > 0 && !/\s/.test(value[from - 1]!) ? " " : ""}{{${token}}}`;
    onChange(value.slice(0, from) + text + value.slice(to));
    caret.current = { from: from + text.length, to: from + text.length };
  };

  return (
    <>
      <Field label={label}>
        <input
          type="text"
          className={styles.input}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            remember(e.target);
          }}
          onSelect={(e) => remember(e.currentTarget)}
        />
      </Field>
      <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Done picking" : "Pick a chair"}
      </button>
      {open && <ChairPicker template={value} cardTable={cardTable} onPick={insert} />}
    </>
  );
}

/** The smallest a chair is to click or tap, as a radius on screen. */
const TARGET_PX = 12;

/**
 * The map: tables and their chairs, from the room as it stands. A chair at a
 * table that numbers its seats is a button; one where guests sit where they
 * like is not, and says why. Chairs this text already names are ringed. The
 * map is one stop on Tab; arrow keys go chair to chair.
 */
function ChairPicker({
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
    () => (cardTable ? (room.tables.find((t) => normalise(t.label) === normalise(cardTable)) ?? null) : null),
    [room, cardTable],
  );
  const [chosen, setChosen] = useState<Mode>("table");
  // A card with no table of its own (or a guest with none yet) can only name the room's chairs.
  const mode: Mode = chosen === "table" && own ? "table" : "room";
  // In the room, one table up close: a whole room's chairs are small to hit.
  const [near, setNear] = useState("");
  const nearTable = room.tables.find((t) => t.label === near) ?? null;
  const showing = mode === "table" ? [own!] : nearTable ? [nearTable] : room.tables;

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
  const freeSeating = mode === "table" && !own!.numbered;

  // How big a room unit is on screen, so a chair is never too small to hit.
  const svg = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setDrawn({ w: width, h: height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showing.length]);
  // The map is scaled to fit its box both ways (SVG's default "meet").
  const unitsPerPx = drawn.w > 0 && drawn.h > 0 ? Math.max(bounds.w / drawn.w, bounds.h / drawn.h) : 0;

  // The chairs that can be picked, in order: one tab stop, arrows between them.
  const chairs = showing.flatMap((table) => (table.numbered ? table.seats.map((seat) => ({ table, seat })) : []));
  const [active, setActive] = useState(0);
  const buttons = useRef<Array<SVGCircleElement | null>>([]);
  const focusChair = (index: number) => {
    const next = Math.max(0, Math.min(chairs.length - 1, index));
    setActive(next);
    buttons.current[next]?.focus();
  };

  const pick = (table: RoomTable, seat: number) => {
    const ref: ChairRef = { table: mode === "table" ? null : table.label, seat };
    onPick(chairToken(ref));
  };

  return (
    <div className={styles.picker}>
      <div className={styles.modes} role="group" aria-label="Which chairs">
        <button type="button" aria-pressed={mode === "table"} disabled={!own} onClick={() => setChosen("table")}>
          This card's table
        </button>
        <button type="button" aria-pressed={mode === "room"} onClick={() => setChosen("room")}>
          The room
        </button>
      </div>
      <Hint>
        {!own
          ? "This card is not for one table, so its chairs are picked from the room: each one says whoever sits there, on every card."
          : mode === "table"
            ? "Seat by seat on this card's table: every table's card fills in its own."
            : "One chair in the room: it says whoever sits there, on every card."}
      </Hint>

      {mode === "room" && room.tables.length > 1 && (
        <SelectField
          label="Up close"
          value={nearTable ? nearTable.label : ""}
          options={[{ value: "", label: "The whole room" }, ...room.tables.map((t) => ({ value: t.label, label: t.label }))]}
          onChange={setNear}
        />
      )}
      {room.tables.length === 0 ? (
        <Hint>There is no seating plan yet. Add tables in Seating, and they appear here.</Hint>
      ) : (
        <svg
          ref={svg}
          className={styles.map}
          viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
          role="group"
          aria-label={mode === "table" ? `${own!.label} and its chairs` : "The room and its chairs"}
        >
          {showing.map((table) => {
            // Half the gap to the nearest chair at this table: targets grow, but never into a neighbour.
            const spare = nearestGap(table) / 2;
            const hit = Math.max(room.seatRadius, Math.min(TARGET_PX * unitsPerPx, spare));
            return (
              <g key={table.label} className={table.numbered ? undefined : styles.free}>
                <path
                  d={table.pathD}
                  transform={`translate(${table.x} ${table.y}) rotate(${table.rotationDeg})`}
                  className={showing.length > 1 ? `${styles.table} ${styles.zoomable}` : styles.table}
                  // A click on a table brings it up close; "Up close" does the same from the keyboard.
                  onClick={showing.length > 1 ? () => setNear(table.label) : undefined}
                >
                  <title>{table.numbered ? table.label : `${table.label}: guests sit where they like`}</title>
                </path>
                {table.seats.map((seat) => {
                  if (!table.numbered) {
                    return <circle key={seat.number} cx={seat.x} cy={seat.y} r={room.seatRadius} className={styles.idle} />;
                  }
                  const index = chairs.findIndex((c) => c.table === table && c.seat === seat);
                  const key = `${normalise(table.label)}#${seat.number}`;
                  const who = seat.row ? chairName(design, seat.row) : "empty";
                  const label = `${table.label}, seat ${seat.number}: ${who}`;
                  const press = () => {
                    setActive(index);
                    pick(table, seat.number);
                  };
                  return (
                    <g key={seat.number} className={used.has(key) ? `${styles.chair} ${styles.used}` : styles.chair}>
                      <circle cx={seat.x} cy={seat.y} r={room.seatRadius} className={styles.seat} />
                      <circle
                        ref={(el) => {
                          buttons.current[index] = el;
                        }}
                        cx={seat.x}
                        cy={seat.y}
                        r={hit}
                        className={styles.hit}
                        role="button"
                        tabIndex={index === Math.min(active, chairs.length - 1) ? 0 : -1}
                        aria-label={label}
                        onClick={press}
                        onKeyDown={(e: KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            press();
                          } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                            e.preventDefault();
                            focusChair(index + 1);
                          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                            e.preventDefault();
                            focusChair(index - 1);
                          } else if (e.key === "Home") {
                            e.preventDefault();
                            focusChair(0);
                          } else if (e.key === "End") {
                            e.preventDefault();
                            focusChair(chairs.length - 1);
                          }
                        }}
                      >
                        <title>{label}</title>
                      </circle>
                    </g>
                  );
                })}
              </g>
            );
          })}
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

/** The closest two chairs at a table come, centre to centre. */
function nearestGap(table: RoomTable): number {
  let best = Infinity;
  for (const [i, a] of table.seats.entries()) {
    for (const b of table.seats.slice(i + 1)) best = Math.min(best, Math.hypot(a.x - b.x, a.y - b.y));
  }
  return best;
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
