"use client";

import { useState } from "react";
import { Heart, Plus } from "lucide-react";
import { Button, Panel, TextArea, TextField } from "@/components/ui/controls";
import { GuestChip, GuestPicker } from "./GuestPicker";
import { memberDescriptor } from "@/lib/ensemble/resolve";
import { addMember, patchShot, removeMember } from "@/lib/ensemble/actions";
import type { Event as WeddingEvent } from "@jfrusher/trousseau";
import { roleLabel } from "@/lib/model/partners";
import { CAST_ROLES, type CastSlice, type Guest, type Seating, type Shot, type ShotMember, type Shots } from "@/lib/model/types";

export function ShotInspector({
  shot,
  shots,
  cast,
  guests,
  seating,
  event,
  onChange,
}: {
  shot: Shot;
  shots: Shots;
  cast: CastSlice;
  guests: Record<string, Guest>;
  seating: Seating;
  event: WeddingEvent;
  onChange: (next: Shots) => void;
}) {
  const [textValue, setTextValue] = useState("");

  const add = (member: ShotMember) => onChange(addMember(shots, shot.id, member));
  const hasRole = (role: string) => shot.members.some((m) => m.kind === "role" && m.ref === role);

  const addCouple = () => {
    let next = shots;
    if (!hasRole("a")) next = addMember(next, shot.id, { kind: "role", ref: "a" });
    if (!hasRole("b")) next = addMember(next, shot.id, { kind: "role", ref: "b" });
    onChange(next);
  };

  const availableRoles = CAST_ROLES.filter((role) => !hasRole(role));
  const availableCustomRoles = cast.customRoles.filter(
    (r) => !shot.members.some((m) => m.kind === "customRole" && m.ref === r.id),
  );
  const availableFamilies = Object.values(seating.families).filter(
    (f) => !shot.members.some((m) => m.kind === "family" && m.ref === f.id),
  );
  const availableGroups = [...Object.values(seating.groups), ...Object.values(seating.subgroups)].filter(
    (g) => !shot.members.some((m) => m.kind === "group" && m.ref === g.id),
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <Panel title="Shot">
        <TextField
          label="Label"
          value={shot.label}
          onChange={(label) => onChange(patchShot(shots, shot.id, { label }))}
          placeholder="Leave blank to build it from who's in it"
        />
      </Panel>

      <Panel title="Who's in it">
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {shot.members.map((member, index) => (
            <li key={index}>
              <GuestChip
                name={memberDescriptor(member, guests, seating, cast.customRoles, event)}
                onRemove={() => onChange(removeMember(shots, shot.id, index))}
              />
            </li>
          ))}
          {shot.members.length === 0 && <li className="text-sm text-slate">Nobody added yet.</li>}
        </ul>

        {!(hasRole("a") && hasRole("b")) && (
          <div className="mb-2">
            <Button icon={Heart} tone="primary" onClick={addCouple}>
              + The couple
            </Button>
          </div>
        )}

        <ul className="mb-2 flex flex-wrap gap-1.5">
          {availableRoles.map((role) => (
            <li key={role}>
              <QuickAddChip label={roleLabel(role, event)} onClick={() => add({ kind: "role", ref: role })} />
            </li>
          ))}
          {availableCustomRoles.map((r) => (
            <li key={r.id}>
              <QuickAddChip label={r.name} onClick={() => add({ kind: "customRole", ref: r.id })} />
            </li>
          ))}
          {availableFamilies.map((f) => (
            <li key={f.id}>
              <QuickAddChip label={f.name} onClick={() => add({ kind: "family", ref: f.id })} />
            </li>
          ))}
          {availableGroups.map((g) => (
            <li key={g.id}>
              <QuickAddChip label={g.name} onClick={() => add({ kind: "group", ref: g.id })} />
            </li>
          ))}
        </ul>

        <GuestPicker
          guests={guests}
          exclude={shot.members.filter((m) => m.kind === "guest").map((m) => m.ref)}
          onPick={(guestId) => add({ kind: "guest", ref: guestId })}
        />

        <div className="mt-2 flex gap-2">
          <TextField value={textValue} onChange={setTextValue} placeholder="Or type something else, e.g. the dog" />
          <Button
            tone="quiet"
            onClick={() => {
              if (!textValue.trim()) return;
              add({ kind: "text", ref: textValue.trim() });
              setTextValue("");
            }}
          >
            Add
          </Button>
        </div>
      </Panel>

      <Panel title="Notes">
        <TextArea value={shot.notes} onChange={(notes) => onChange(patchShot(shots, shot.id, { notes }))} />
      </Panel>
    </div>
  );
}

function QuickAddChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-charcoal/25 px-2 py-0.5 text-xs text-slate transition hover:border-gold hover:text-charcoal"
    >
      <Plus size={11} />
      {label}
    </button>
  );
}
