"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Printer, Trash2, Wand2 } from "lucide-react";
import type { Event as WeddingEvent } from "@jfrusher/trousseau";
import { Button, Empty, IconButton, Panel, Segmented, TextField } from "@/components/ui/controls";
import { ToolUndo } from "@/components/shell/ToolUndo";
import { MemberPicker } from "@/components/cast/MemberPicker";
import { resolveMembers, type MemberProblem } from "@/lib/cast/resolve";
import { addGroup, addMembers, moveGroup, patchGroup, removeGroup, removeMember } from "@/lib/ceremony/actions";
import { suggestOrder } from "@/lib/ceremony/propose";
import { FORMATION_WORDS, processionalRows, processionalText } from "@/lib/ceremony/rows";
import { download } from "@/lib/data/file";
import { sideLabel } from "@/lib/model/partners";
import { useCast, useCeremony, useEvent, useGuests, useSeating, useStatus, useWriters } from "@/lib/model/useSuite";
import type { CastSlice, Ceremony, Formation, Guest, Seating, Side, WalkGroup } from "@/lib/model/types";

/**
 * The processional: who walks, in the order they walk, how, which side they
 * go to, and what they walk to. It keeps no copy of anything — it reads the
 * wedding and writes it, on the wedding's one history — and its people come
 * from the one cast Group shots uses.
 */
export function CeremonyBoard() {
  const status = useStatus();
  const event = useEvent();
  const guests = useGuests();
  const seating = useSeating();
  const cast = useCast();
  const ceremony = useCeremony();
  const { setCeremony } = useWriters();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (status !== "ready") return null;

  const processional = ceremony.processional;
  const selected = processional.find((group) => group.id === selectedId) ?? null;
  const resolve = (group: WalkGroup) => resolveMembers(group, guests, seating, cast.roles, cast.customRoles, event);

  const rows = () => processionalRows(processional, guests, seating, cast, event);

  const print = async () => {
    setNote(null);
    try {
      const [{ renderProcessionalSheet }, { browserFontSource }] = await Promise.all([
        import("@/lib/ceremony/render/pdf/processionalSheet"),
        import("@/apps/brigade/render/pdf/fontSource"),
      ]);
      const bytes = await renderProcessionalSheet(rows(), {
        fontSource: browserFontSource(),
        coupleNames: event.coupleNames,
        generatedOn: `Made with Trousseau, ${new Date().toLocaleDateString()}`,
      });
      const slug = (event.coupleNames || "wedding").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      download(`${slug || "wedding"}-processional.pdf`, new Blob([bytes as BlobPart], { type: "application/pdf" }));
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "The page could not be made.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(processionalText(rows(), event));
      setNote("Copied — paste it into an email to the wedding party.");
    } catch {
      setNote("This browser would not copy. Print the page instead.");
    }
  };

  const add = () => {
    const next = addGroup(ceremony);
    setCeremony(next, { label: "adding a group" });
    setSelectedId(next.processional[next.processional.length - 1]!.id);
  };

  return (
    <div className="flex h-[calc(100dvh-var(--shell-header-h))]">
      <ToolUndo />
      <div data-tour="ceremony.order" className="flex w-96 shrink-0 flex-col border-r border-charcoal/10">
        <div className="flex gap-2 border-b border-charcoal/10 p-3">
          <Button icon={Plus} onClick={add}>
            Add a group
          </Button>
          {processional.length === 0 ? (
            <Button icon={Wand2} onClick={() => setCeremony({ ...ceremony, processional: suggestOrder(cast) }, { label: "suggesting an order" })}>
              Suggest an order
            </Button>
          ) : (
            <>
              <Button icon={Printer} onClick={() => void print()}>
                Print
              </Button>
              <Button icon={Copy} onClick={() => void copy()}>
                Copy as text
              </Button>
            </>
          )}
        </div>
        {note && (
          <p role="status" className="border-b border-charcoal/10 px-3 py-2 text-xs text-slate">
            {note}
          </p>
        )}

        {processional.length === 0 ? (
          <div className="p-4">
            <Empty>
              Nobody walking yet. Suggest an order from who&rsquo;s who — the officiant, grandparents, parents, the
              wedding parties, then the two of you — and change anything in it, or add groups one at a time.
            </Empty>
          </div>
        ) : (
          <ol aria-label="The processional" className="flex-1 overflow-y-auto p-1.5">
            {processional.map((group, index) => {
              const resolved = resolve(group);
              return (
                <li
                  key={group.id}
                  className={`flex items-start gap-1 rounded px-2 py-1.5 ${group.id === selectedId ? "bg-stone" : "hover:bg-stone/50"}`}
                >
                  <button type="button" onClick={() => setSelectedId(group.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm text-charcoal">
                      {index + 1}. {resolved.label}
                      {resolved.problems.length > 0 && <span className="ml-1 text-danger">●</span>}
                    </div>
                    <div className="truncate text-xs text-slate">
                      {[FORMATION_WORDS[group.formation], group.music && `♪ ${group.music}`].filter(Boolean).join(" · ")}
                    </div>
                  </button>
                  <IconButton
                    icon={ArrowUp}
                    label={`Move ${resolved.label} earlier`}
                    onClick={() => setCeremony(moveGroup(ceremony, index, index - 1), { label: "changing the order" })}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label={`Move ${resolved.label} later`}
                    onClick={() => setCeremony(moveGroup(ceremony, index, index + 1), { label: "changing the order" })}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        {selected ? (
          <GroupInspector
            group={selected}
            ceremony={ceremony}
            cast={cast}
            guests={guests}
            seating={seating}
            event={event}
            problems={resolve(selected).problems}
            onChange={setCeremony}
            onRemoved={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Empty>{processional.length === 0 ? "The order appears on the left." : "Pick a group on the left."}</Empty>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupInspector({
  group,
  ceremony,
  cast,
  guests,
  seating,
  event,
  problems,
  onChange,
  onRemoved,
}: {
  group: WalkGroup;
  ceremony: Ceremony;
  cast: CastSlice;
  guests: Record<string, Guest>;
  seating: Seating;
  event: WeddingEvent;
  problems: MemberProblem[];
  onChange: (next: Ceremony, options: { label: string }) => void;
  onRemoved: () => void;
}) {
  const patch = (change: Partial<Omit<WalkGroup, "id">>, label: string) => onChange(patchGroup(ceremony, group.id, change), { label });
  const sides: Array<{ value: Side; label: string }> = [
    { value: "a", label: sideLabel("a", event) },
    { value: "b", label: sideLabel("b", event) },
    { value: "both", label: "Both sides" },
    { value: "", label: "Not said" },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <Panel title="Group">
        <TextField
          label="Label"
          value={group.label}
          onChange={(label) => patch({ label }, "a group's label")}
          placeholder="Leave blank to build it from who walks"
        />
      </Panel>

      <Panel title="Who walks">
        {problems.length > 0 && (
          <ul className="mb-2 text-sm text-danger">
            {problems.map((problem, index) => (
              <li key={index}>{describe(problem)}</li>
            ))}
          </ul>
        )}
        <MemberPicker
          members={group.members}
          customRoles={cast.customRoles}
          guests={guests}
          seating={seating}
          event={event}
          onAdd={(members) => onChange(addMembers(ceremony, group.id, members), { label: "who walks" })}
          onRemove={(index) => onChange(removeMember(ceremony, group.id, index), { label: "who walks" })}
          textPlaceholder="Or type a name, e.g. the officiant"
        />
      </Panel>

      <Panel title="How they walk">
        <Segmented
          value={group.formation}
          onChange={(formation) => patch({ formation }, "how a group walks")}
          options={(Object.keys(FORMATION_WORDS) as Formation[]).map((value) => ({ value, label: FORMATION_WORDS[value] }))}
        />
      </Panel>

      <Panel title="Where they go">
        <Segmented value={group.side} onChange={(side) => patch({ side }, "where a group goes")} options={sides} />
      </Panel>

      <Panel title="Music">
        <div className="flex flex-col gap-2">
          <TextField label="What they walk to" value={group.music} onChange={(music) => patch({ music }, "the music")} placeholder="e.g. Canon in D" />
          <TextField label="When" value={group.cue} onChange={(cue) => patch({ cue }, "a cue")} placeholder="e.g. The music changes as the couple enter" />
        </div>
      </Panel>

      <div>
        <Button
          tone="danger"
          icon={Trash2}
          onClick={() => {
            onChange(removeGroup(ceremony, group.id), { label: "removing a group" });
            onRemoved();
          }}
        >
          Remove this group
        </Button>
      </div>
    </div>
  );
}

function describe(problem: MemberProblem): string {
  switch (problem.kind) {
    case "dangling":
      return `${problem.detail}.`;
    case "declined":
      return `${problem.name} has declined.`;
    case "empty":
      return "Nobody is in this group yet.";
  }
}
