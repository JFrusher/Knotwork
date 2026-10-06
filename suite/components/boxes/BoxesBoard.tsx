"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, ListChecks, PackagePlus, Plus, Tag, Trash2, X } from "lucide-react";
import { formatClock } from "@/lib/minutes";
import { Button, Empty, IconButton, NumberField, Panel, SelectField, TextArea, TextField } from "@/components/ui/controls";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToolUndo } from "@/components/shell/ToolUndo";
import { addBox, addItem, moveItem, patchBox, patchItem, removeBox, removeItem, USUAL_BOXES, withUsualBoxes } from "@/lib/boxes/actions";
import { find, neededAt, packing, whereBy } from "@/lib/boxes/view";
import { boxesCsv, boxRows } from "@/lib/boxes/rows";
import { download } from "@/lib/data/file";
import { dayPlaces, personName, type Place } from "@/lib/model/slices";
import { useBoxes, useCrew, useEvent, useGuests, useStatus, useWriters } from "@/lib/model/useSuite";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import type { Box, Boxes, Crew, Guest } from "@/lib/model/types";

const CONTROL = "rounded border border-charcoal/15 bg-parchment px-2 py-1 text-sm text-charcoal focus:border-gold";

/**
 * The boxes: what is in each, found in a moment, and where each has to be by
 * when — the where and the when being the Timeline's, for the block a box is
 * needed for. It keeps no copy: it reads the wedding and writes it, on the
 * wedding's one history.
 */
export function BoxesBoard() {
  const status = useStatus();
  const boxes = useBoxes();
  const crew = useCrew();
  const guests = useGuests();
  const event = useEvent();
  const places = useKnotworkStore((s) => dayPlaces(s.doc));
  const { setBoxes } = useWriters();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const found = useMemo(() => find(boxes, query), [boxes, query]);

  if (status !== "ready") return null;

  const selected = boxes.boxes.find((box) => box.id === selectedId) ?? null;
  const have = new Set(boxes.boxes.map((box) => box.name.trim().toLowerCase()));
  const usualMissing = USUAL_BOXES.some((usual) => !have.has(usual.name.toLowerCase()));

  const stem = (event.coupleNames || "wedding").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wedding";
  const rows = () => boxRows(boxes, places, crew, guests);

  const print = async (what: "labels" | "list") => {
    setNote(null);
    try {
      const { browserFontSource } = await import("@/lib/pdf/fontSource");
      const fontSource = browserFontSource();
      const bytes =
        what === "labels"
          ? await (await import("@/lib/boxes/render/pdf/labels")).renderBoxLabels(rows(), { fontSource })
          : await (await import("@/lib/boxes/render/pdf/packingList")).renderPackingList(rows(), {
              fontSource,
              coupleNames: event.coupleNames,
              generatedOn: `Made with Knotwork, ${new Date().toLocaleDateString()}`,
            });
      download(`${stem}-${what === "labels" ? "box-labels" : "packing-list"}.pdf`, new Blob([bytes as BlobPart], { type: "application/pdf" }));
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "The page could not be made.");
    }
  };

  const add = () => {
    const next = addBox(boxes);
    setBoxes(next, { label: "adding a box" });
    setSelectedId(next.boxes[next.boxes.length - 1]!.id);
  };

  return (
    <div className="flex h-[calc(100dvh-var(--shell-header-h))]">
      <ToolUndo />
      <div data-tour="boxes.list" className="flex w-96 shrink-0 flex-col border-r border-charcoal/10">
        <div className="flex flex-wrap gap-2 border-b border-charcoal/10 p-3">
          <Button icon={Plus} onClick={add}>
            Add a box
          </Button>
          {usualMissing && (
            <Button icon={PackagePlus} onClick={() => setBoxes(withUsualBoxes(boxes), { label: "adding the usual boxes" })}>
              Add the usual boxes
            </Button>
          )}
        </div>
        {boxes.boxes.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-charcoal/10 p-3">
            <Button icon={Tag} onClick={() => void print("labels")}>
              Labels
            </Button>
            <Button icon={ListChecks} onClick={() => void print("list")}>
              Packing list
            </Button>
            <Button icon={FileSpreadsheet} onClick={() => download(`${stem}-boxes.csv`, boxesCsv(rows()), "text/csv")}>
              CSV
            </Button>
          </div>
        )}
        {note && (
          <p role="status" className="border-b border-charcoal/10 px-3 py-2 text-xs text-danger">
            {note}
          </p>
        )}
        <div className="border-b border-charcoal/10 p-3">
          <TextField label="Find something" value={query} onChange={setQuery} placeholder="Shoes, the rings…" />
        </div>

        {query.trim() ? (
          <ul aria-label="Found" className="flex-1 overflow-y-auto p-1.5">
            {found.length === 0 && <li className="p-2 text-sm text-slate">Not in any box.</li>}
            {found.map(({ box, item }) => (
              <li key={`${box.id}-${item?.id ?? "box"}`}>
                <button
                  type="button"
                  onClick={() => setSelectedId(box.id)}
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-stone/50"
                >
                  <span className="text-charcoal">{item ? item.label : box.name}</span>
                  <span className="block text-xs text-slate">
                    {item ? `In box ${box.number}, ${box.name || "with no name"}` : `Box ${box.number}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : boxes.boxes.length === 0 ? (
          <div className="p-4">
            <Empty>
              No boxes yet. Add the usual ones — the rings and the paperwork, getting ready, the day&rsquo;s odds and
              ends, overnight — and change anything in them, or add boxes one at a time.
            </Empty>
          </div>
        ) : (
          <ol aria-label="The boxes" className="flex-1 overflow-y-auto p-1.5">
            {boxes.boxes.map((box) => {
              const { place, lost } = neededAt(box, places);
              const { packed, total } = packing(box);
              // Nobody taking it matters only for a box that has somewhere to be.
              const trouble = lost || (box.blockId !== null && box.personIds.length === 0);
              return (
                <li key={box.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(box.id)}
                    className={`w-full rounded px-2 py-1.5 text-left ${box.id === selectedId ? "bg-stone" : "hover:bg-stone/50"}`}
                  >
                    <span className="block truncate text-sm text-charcoal">
                      {box.number}. {box.name || "A box with no name"}
                      {trouble && <span className="ml-1 text-danger">●</span>}
                    </span>
                    <span className="block truncate text-xs text-slate">
                      {whereBy(place, lost)} · {total === 0 ? "Nothing in it yet" : `${packed} of ${total} packed`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        {selected ? (
          <BoxInspector
            box={selected}
            boxes={boxes}
            crew={crew}
            guests={guests}
            places={places}
            onChange={setBoxes}
            onRemoved={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Empty>{boxes.boxes.length === 0 ? "The boxes appear on the left." : "Pick a box on the left."}</Empty>
          </div>
        )}
      </div>
    </div>
  );
}

function BoxInspector({
  box,
  boxes,
  crew,
  guests,
  places,
  onChange,
  onRemoved,
}: {
  box: Box;
  boxes: Boxes;
  crew: Crew;
  guests: Record<string, Guest>;
  places: ReadonlyMap<string, Place>;
  onChange: (next: Boxes, options: { label: string }) => void;
  onRemoved: () => void;
}) {
  const [newItem, setNewItem] = useState("");
  const { lost } = neededAt(box, places);
  const patch = (change: Partial<Omit<Box, "id" | "items">>, label: string) => onChange(patchBox(boxes, box.id, change), { label });
  const blocks = [...places.entries()].sort(([, a], [, b]) => a.startMin - b.startMin);
  const others = boxes.boxes.filter((other) => other.id !== box.id);
  const people = new Map(crew.people.map((person) => [person.id, person]));
  const addable = crew.people.filter((person) => !box.personIds.includes(person.id));

  const addNew = () => {
    const next = addItem(boxes, box.id, newItem);
    if (next !== boxes) onChange(next, { label: "what is in a box" });
    setNewItem("");
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <Panel title="Box">
        <div className="flex gap-3">
          <div className="w-24">
            <NumberField label="Number" value={box.number} min={1} onChange={(number) => patch({ number }, "a box's number")} />
          </div>
          <div className="flex-1">
            <TextField label="Name" value={box.name} onChange={(name) => patch({ name }, "a box's name")} placeholder="e.g. Getting ready — Alex" />
          </div>
        </div>
      </Panel>

      <Panel title="Needed for">
        {lost && (
          <p className="mb-2 text-sm text-danger">The part of the day it was needed for is no longer on the Timeline. Say where it is needed now.</p>
        )}
        <SelectField
          label="The part of the day it has to be there for"
          value={box.blockId !== null && places.has(box.blockId) ? box.blockId : ""}
          onChange={(blockId) => patch({ blockId: blockId || null }, "where a box is needed")}
          options={[
            { value: "", label: "Not for the day" },
            ...blocks.map(([id, place]) => ({
              value: id,
              label: `${formatClock(place.startMin)} · ${place.label}${place.location ? ` · ${place.location}` : ""}`,
            })),
          ]}
        />
      </Panel>

      <Panel title="Who takes it">
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {box.personIds.map((id) => {
            const person = people.get(id);
            const name = person ? personName(person, guests) : "Someone no longer in the crew";
            return (
              <li key={id} className="inline-flex items-center gap-1 rounded-full bg-stone px-2 py-0.5 text-xs text-charcoal">
                {name}
                <button
                  type="button"
                  aria-label={`${name} is not taking it`}
                  onClick={() => patch({ personIds: box.personIds.filter((other) => other !== id) }, "who takes a box")}
                  className="text-slate hover:text-danger"
                >
                  <X size={11} aria-hidden />
                </button>
              </li>
            );
          })}
          {box.personIds.length === 0 &&
            (box.blockId === null ? (
              <li className="text-sm text-slate">Nobody named: fine for a box that is not for the day.</li>
            ) : (
              <li className="text-sm text-danger">Nobody is taking it there yet.</li>
            ))}
        </ul>
        {crew.people.length === 0 ? (
          <p className="text-sm text-slate">Add the people helping on the day in Delegation, and they can be picked here.</p>
        ) : (
          addable.length > 0 && (
            <select
              aria-label="Somebody to take it"
              value=""
              onChange={(event) => event.target.value && patch({ personIds: [...box.personIds, event.target.value] }, "who takes a box")}
              className={CONTROL}
            >
              <option value="">Add somebody…</option>
              {addable.map((person) => (
                <option key={person.id} value={person.id}>
                  {personName(person, guests)}
                </option>
              ))}
            </select>
          )
        )}
      </Panel>

      <Panel title="In it">
        <ul className="mb-2 flex flex-col gap-1">
          {box.items.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={`${item.label} is packed`}
                checked={item.packed}
                onChange={(event) => onChange(patchItem(boxes, box.id, item.id, { packed: event.target.checked }), { label: "packing" })}
                className="accent-[var(--color-gold)]"
              />
              <input
                aria-label="What it is"
                value={item.label}
                onChange={(event) => onChange(patchItem(boxes, box.id, item.id, { label: event.target.value }), { label: "what is in a box" })}
                className={`${CONTROL} min-w-0 flex-1 ${item.packed ? "text-slate line-through" : ""}`}
              />
              <NumberInput
                label={`How many of ${item.label}`}
                value={item.quantity}
                onCommit={(quantity) => onChange(patchItem(boxes, box.id, item.id, { quantity: Math.max(1, quantity ?? 1) }), { label: "what is in a box" })}
                className={`${CONTROL} w-14`}
              />
              {others.length > 0 && (
                <select
                  aria-label={`Move ${item.label} to another box`}
                  value=""
                  onChange={(event) => event.target.value && onChange(moveItem(boxes, item.id, event.target.value), { label: "moving something" })}
                  className={`${CONTROL} w-28`}
                >
                  <option value="">Move to…</option>
                  {others.map((other) => (
                    <option key={other.id} value={other.id}>
                      Box {other.number}
                      {other.name ? ` — ${other.name}` : ""}
                    </option>
                  ))}
                </select>
              )}
              <IconButton icon={Trash2} label={`Take ${item.label} out`} tone="danger" onClick={() => onChange(removeItem(boxes, box.id, item.id), { label: "what is in a box" })} />
            </li>
          ))}
          {box.items.length === 0 && <li className="text-sm text-slate">Nothing in it yet.</li>}
        </ul>
        <div className="flex gap-2">
          <TextField value={newItem} onChange={setNewItem} placeholder="Something to pack" />
          <Button tone="quiet" onClick={addNew}>
            Add
          </Button>
        </div>
      </Panel>

      <Panel title="Notes">
        <TextArea value={box.notes} onChange={(notes) => patch({ notes }, "a box's notes")} />
      </Panel>

      <div>
        <Button
          tone="danger"
          icon={Trash2}
          onClick={() => {
            onChange(removeBox(boxes, box.id), { label: "removing a box" });
            onRemoved();
          }}
        >
          Remove this box
        </Button>
      </div>
    </div>
  );
}
