"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, FileUp, Trash2 } from "lucide-react";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { DIETARY_KEYS, dietaryLabel, type DietaryKey } from "@/lib/model/dietary";
import { sideLabel } from "@/lib/model/partners";
import { readSeating } from "@/lib/model/slices";
import type { RsvpStatus, Side } from "@/lib/model/types";
import { changeGuests, dropGuests, seatGuests, type GuestChange, type GuestSlices } from "@/lib/guests/edit";
import { guestRows, NO_FILTER, shownRows, type GuestRow, type ListFilter, type ListSort, type SortKey } from "@/lib/guests/list";
import { Button, Empty } from "@/components/ui/controls";
import { useConfirm } from "@/components/ui/Confirm";
import { ToolUndo } from "@/components/shell/ToolUndo";
import { useGuestImport } from "@/components/shell/guestImportPanel";

const REPLIES: Array<{ value: RsvpStatus; label: string }> = [
  { value: "confirmed", label: "Yes" },
  { value: "pending", label: "Not yet" },
  { value: "declined", label: "No" },
];

const CONTROL = "rounded border border-charcoal/15 bg-parchment px-2 py-1 text-sm text-charcoal focus:border-gold";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The slices as stored now: each change starts from the latest, not from the last render. */
function stored(): GuestSlices {
  const { raw } = useTrousseauStore.getState();
  return { guests: isRecord(raw["guests"]) ? raw["guests"] : {}, seating: isRecord(raw["seating"]) ? raw["seating"] : {} };
}

/**
 * Everyone on the list, as a table: find anyone, change a reply, a side, what
 * they eat or where they sit, and change many at once.
 *
 * It keeps no copy of the list. It reads the wedding and writes it, as Group
 * shots does, so its changes are on the one undo stack and in every tool the
 * moment they are made. Table moves go through Seating's own commands — see
 * `lib/guests/edit`.
 */
export function GuestsPage() {
  const status = useTrousseauStore((s) => s.status);
  const doc = useTrousseauStore((s) => s.doc);
  const past = useTrousseauStore((s) => s.past);
  const future = useTrousseauStore((s) => s.future);
  const showImport = useGuestImport((s) => s.show);
  const confirm = useConfirm();

  const [filter, setFilter] = useState<ListFilter>(NO_FILTER);
  // A link to one guest — the command palette's — opens the list found to them.
  const asked = useSearchParams().get("q");
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (asked === null) return;
    setFilter({ ...NO_FILTER, text: asked });
    router.replace(pathname, { scroll: false });
  }, [asked, pathname, router]);
  const [sort, setSort] = useState<ListSort>({ key: "name", direction: "ascending" });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const rows = useMemo(() => guestRows(doc), [doc]);
  const shown = useMemo(() => shownRows(rows, filter, sort), [rows, filter, sort]);
  const tables = useMemo(() => {
    const all = Object.values(readSeating(doc).tables);
    return all
      .map((table) => ({ id: table.id, label: table.label || "Unnamed table", free: table.capacity - table.assignedGuestIds.filter(Boolean).length }))
      .sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
  }, [doc]);

  if (status !== "ready") return <div className="mx-auto mt-10 h-40 max-w-7xl animate-pulse rounded-lg bg-stone" />;

  // Only what can be seen is acted on: a filter changed after ticking must not
  // leave hidden guests in the change.
  const chosenRows = shown.filter((row) => selected.has(row.guest.id));
  const chosen = chosenRows.map((row) => row.guest.id);
  const chosenTags = [...new Set(chosenRows.flatMap((row) => row.guest.tags))].sort();

  const change = (ids: readonly string[], what: GuestChange, label: string) =>
    useTrousseauStore.getState().setSlice("guests", changeGuests(stored(), ids, what).guests, { label });
  const seat = (ids: readonly string[], tableId: string | null) => {
    const next = seatGuests(stored(), ids, tableId);
    useTrousseauStore.getState().setSlices([["guests", next.guests], ["seating", next.seating]], { label: "seating" });
  };
  const remove = async (ids: readonly string[]) => {
    const ok = await confirm({
      title: ids.length === 1 ? "Take this guest off the list?" : `Take ${ids.length} guests off the list?`,
      body: "They come out of their table, their group and the group shots' list of people too. Undo brings them back.",
      action: "Take them off",
      tone: "danger",
    });
    if (!ok) return;
    const next = dropGuests(stored(), ids);
    useTrousseauStore.getState().setSlices([["guests", next.guests], ["seating", next.seating]], { label: "removing guests" });
    setSelected(new Set());
  };

  const toggle = (id: string) =>
    setSelected((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allShown = shown.length > 0 && chosen.length === shown.length;

  const sides: Array<{ value: Side; label: string }> = [
    { value: "", label: "Not said" },
    { value: "a", label: sideLabel("a", doc.event) },
    { value: "b", label: sideLabel("b", doc.event) },
    { value: "both", label: sideLabel("both", doc.event) },
  ];
  const filtering = JSON.stringify(filter) !== JSON.stringify(NO_FILTER);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <ToolUndo
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={() => useTrousseauStore.getState().undo()}
        onRedo={() => useTrousseauStore.getState().redo()}
        undoLabel={past[past.length - 1]?.label ?? null}
        redoLabel={future[future.length - 1]?.label ?? null}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-charcoal">Guests</h1>
          <p className="mt-1 text-sm text-slate">
            {rows.length === 1 ? "One guest" : `${rows.length} guests`} on the list
            {filtering ? ` · showing ${shown.length}` : ""}
          </p>
        </div>
        <Button icon={FileUp} onClick={showImport}>
          Import guests
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-10">
          <Empty>No guest list yet. Import one, or paste names in setup — everything else is built on it.</Empty>
        </div>
      ) : (
        <>
          <div data-tour="guests.filters" role="search" className="mt-6 flex flex-wrap items-end gap-3">
            <Labelled label="Find">
              <input
                type="search"
                value={filter.text}
                onChange={(event) => setFilter({ ...filter, text: event.target.value })}
                placeholder="Name, table, food or tag"
                className={`${CONTROL} w-56`}
              />
            </Labelled>
            <Labelled label="Reply">
              <select value={filter.reply} onChange={(event) => setFilter({ ...filter, reply: event.target.value as ListFilter["reply"] })} className={CONTROL}>
                <option value="all">Any</option>
                {REPLIES.map((reply) => (
                  <option key={reply.value} value={reply.value}>
                    {reply.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Side">
              <select value={filter.side} onChange={(event) => setFilter({ ...filter, side: event.target.value as ListFilter["side"] })} className={CONTROL}>
                <option value="all">Any</option>
                {sides.map((side) => (
                  <option key={side.value} value={side.value}>
                    {side.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Table">
              <select value={filter.table} onChange={(event) => setFilter({ ...filter, table: event.target.value })} className={CONTROL}>
                <option value="all">Any</option>
                <option value="none">No table yet</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Food">
              <select value={filter.dietary} onChange={(event) => setFilter({ ...filter, dietary: event.target.value as ListFilter["dietary"] })} className={CONTROL}>
                <option value="all">Anything</option>
                <option value="any">Any requirement</option>
                {DIETARY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {dietaryLabel(key)}
                  </option>
                ))}
              </select>
            </Labelled>
            {filtering ? <Button onClick={() => setFilter(NO_FILTER)}>Show everyone</Button> : null}
          </div>

          {chosen.length > 0 ? (
            <div role="group" aria-label="Change the ticked guests" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-gold/60 bg-gold/10 px-4 py-2 text-sm">
              <span className="text-charcoal">{chosen.length === 1 ? "One guest ticked" : `${chosen.length} guests ticked`}</span>
              <select aria-label="Set their reply" value="" onChange={(event) => change(chosen, { rsvpStatus: event.target.value as RsvpStatus }, "replies")} className={CONTROL}>
                <option value="" disabled>
                  Reply…
                </option>
                {REPLIES.map((reply) => (
                  <option key={reply.value} value={reply.value}>
                    {reply.label}
                  </option>
                ))}
              </select>
              <select aria-label="Set their side" value="-" onChange={(event) => change(chosen, { side: event.target.value as Side }, "sides")} className={CONTROL}>
                <option value="-" disabled>
                  Side…
                </option>
                {sides.map((side) => (
                  <option key={side.value} value={side.value}>
                    {side.label}
                  </option>
                ))}
              </select>
              <select aria-label="Move them to a table" value="-" onChange={(event) => seat(chosen, event.target.value === "" ? null : event.target.value)} className={CONTROL}>
                <option value="-" disabled>
                  Table…
                </option>
                <option value="">No table</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.label} — {table.free} free
                  </option>
                ))}
              </select>
              <TagAdder onAdd={(tag) => change(chosen, { addTag: tag }, "tags")} />
              {chosenTags.length > 0 ? (
                <select aria-label="Take a tag off them" value="-" onChange={(event) => change(chosen, { removeTag: event.target.value }, "tags")} className={CONTROL}>
                  <option value="-" disabled>
                    Remove a tag…
                  </option>
                  {chosenTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              ) : null}
              <Button tone="danger" icon={Trash2} onClick={() => void remove(chosen)}>
                Take off the list
              </Button>
              <Button onClick={() => setSelected(new Set())}>Untick all</Button>
            </div>
          ) : null}

          <div data-tour="guests.list" className="mt-4 overflow-x-auto rounded-lg border border-charcoal/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone/60 text-xs tracking-wide text-slate uppercase">
                <tr>
                  <th scope="col" className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={allShown ? "Untick everyone shown" : "Tick everyone shown"}
                      checked={allShown}
                      onChange={() => setSelected(allShown ? new Set() : new Set(shown.map((row) => row.guest.id)))}
                    />
                  </th>
                  <SortHeader label="Name" by="name" sort={sort} onSort={setSort} />
                  <SortHeader label="Reply" by="reply" sort={sort} onSort={setSort} />
                  <SortHeader label="Side" by="side" sort={sort} onSort={setSort} />
                  <SortHeader label="Food" by="dietary" sort={sort} onSort={setSort} />
                  <SortHeader label="Table" by="table" sort={sort} onSort={setSort} />
                  <th scope="col" className="px-3 py-2 font-normal">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <GuestLine
                    key={row.guest.id}
                    row={row}
                    ticked={selected.has(row.guest.id)}
                    onTick={() => toggle(row.guest.id)}
                    sides={sides}
                    tables={tables}
                    onChange={(what, label) => change([row.guest.id], what, label)}
                    onSeat={(tableId) => seat([row.guest.id], tableId)}
                  />
                ))}
              </tbody>
            </table>
            {shown.length === 0 ? <p className="px-4 py-6 text-sm text-slate">Nobody on the list matches.</p> : null}
          </div>
        </>
      )}
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate">
      {label}
      {children}
    </label>
  );
}

function SortHeader({ label, by, sort, onSort }: { label: string; by: SortKey; sort: ListSort; onSort: (sort: ListSort) => void }) {
  const active = sort.key === by;
  const Arrow = sort.direction === "ascending" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? sort.direction : "none"} className="px-3 py-2 font-normal">
      <button
        type="button"
        onClick={() => onSort({ key: by, direction: active && sort.direction === "ascending" ? "descending" : "ascending" })}
        className={`inline-flex items-center gap-1 uppercase ${active ? "text-charcoal" : "hover:text-charcoal"}`}
      >
        {label}
        {active ? <Arrow size={12} aria-hidden /> : null}
      </button>
    </th>
  );
}

function GuestLine({
  row,
  ticked,
  onTick,
  sides,
  tables,
  onChange,
  onSeat,
}: {
  row: GuestRow;
  ticked: boolean;
  onTick: () => void;
  sides: Array<{ value: Side; label: string }>;
  tables: Array<{ id: string; label: string; free: number }>;
  onChange: (what: GuestChange, label: string) => void;
  onSeat: (tableId: string | null) => void;
}) {
  const { guest, name } = row;
  return (
    <tr className={`border-t border-charcoal/10 ${ticked ? "bg-gold/10" : ""}`}>
      <td className="px-3 py-1.5">
        <input type="checkbox" aria-label={`Tick ${name}`} checked={ticked} onChange={onTick} />
      </td>
      <th scope="row" className="px-3 py-1.5 font-normal text-charcoal">
        {name}
        {row.plusOne ? <span className="block text-xs text-slate">{row.plusOne}</span> : null}
      </th>
      <td className="px-3 py-1.5">
        <select aria-label={`Reply from ${name}`} value={guest.rsvpStatus} onChange={(event) => onChange({ rsvpStatus: event.target.value as RsvpStatus }, "a reply")} className={CONTROL}>
          {REPLIES.map((reply) => (
            <option key={reply.value} value={reply.value}>
              {reply.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-1.5">
        <select aria-label={`${name}’s side`} value={guest.side} onChange={(event) => onChange({ side: event.target.value as Side }, "a side")} className={CONTROL}>
          {sides.map((side) => (
            <option key={side.value} value={side.value}>
              {side.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-1.5">
        {/* Keyed on the stored words, so an undo shows through. */}
        <input
          key={guest.dietaryRaw}
          aria-label={`What ${name} eats`}
          defaultValue={guest.dietaryRaw}
          placeholder="—"
          onBlur={(event) => {
            if (event.target.value !== guest.dietaryRaw) onChange({ dietaryRaw: event.target.value.trim() }, "a dietary note");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className={`${CONTROL} w-36`}
        />
        {/* The requirement read from their words, where it says something the words do not. */}
        {guest.dietary &&
        guest.dietary !== "other" &&
        dietaryLabel(guest.dietary as DietaryKey).toLowerCase() !== guest.dietaryRaw.trim().toLowerCase() ? (
          <span className="ml-2 text-xs text-slate">{dietaryLabel(guest.dietary as DietaryKey)}</span>
        ) : null}
      </td>
      <td className="px-3 py-1.5">
        <select aria-label={`${name}’s table`} value={guest.assignedTableId ?? ""} onChange={(event) => onSeat(event.target.value === "" ? null : event.target.value)} className={CONTROL}>
          <option value="">No table</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.label}
              {table.id === guest.assignedTableId ? "" : ` — ${table.free} free`}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-1.5 text-xs text-slate">{guest.tags.join(", ")}</td>
    </tr>
  );
}

function TagAdder({ onAdd }: { onAdd: (tag: string) => void }) {
  const [tag, setTag] = useState("");
  const add = () => {
    const clean = tag.trim();
    if (!clean) return;
    onAdd(clean);
    setTag("");
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input
        aria-label="Tag to add to them"
        value={tag}
        onChange={(event) => setTag(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") add();
        }}
        placeholder="Add a tag"
        className={`${CONTROL} w-28`}
      />
      <Button onClick={add} disabled={!tag.trim()}>
        Add
      </Button>
    </span>
  );
}
