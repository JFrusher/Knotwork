"use client";

import { useState } from "react";
import { Heart, Plus } from "lucide-react";
import type { Event as WeddingEvent } from "@jfrusher/trousseau";
import { Button, TextField } from "@/components/ui/controls";
import { GuestChip, GuestPicker } from "@/components/cast/GuestPicker";
import { memberDescriptor } from "@/lib/cast/resolve";
import { roleLabel } from "@/lib/model/partners";
import { CAST_ROLES, type CustomRole, type Guest, type Seating, type ShotMember } from "@/lib/model/types";

/**
 * Who is in a group — a group shot, a processional's group — picked the one
 * way everywhere: a role from the cast, a role of the couple's own, a family,
 * a group, a guest, or a few words for somebody who is none of those.
 *
 * Adding hands back a list, so "+ The couple" is one change and one undo step.
 */
export function MemberPicker({
  members,
  customRoles,
  guests,
  seating,
  event,
  onAdd,
  onRemove,
  textPlaceholder,
}: {
  members: ShotMember[];
  customRoles: CustomRole[];
  guests: Record<string, Guest>;
  seating: Seating;
  event: WeddingEvent;
  onAdd: (members: ShotMember[]) => void;
  onRemove: (index: number) => void;
  textPlaceholder: string;
}) {
  const [textValue, setTextValue] = useState("");

  const hasRole = (role: string) => members.some((m) => m.kind === "role" && m.ref === role);
  const availableRoles = CAST_ROLES.filter((role) => !hasRole(role));
  const availableCustomRoles = customRoles.filter((r) => !members.some((m) => m.kind === "customRole" && m.ref === r.id));
  const availableFamilies = Object.values(seating.families).filter(
    (f) => !members.some((m) => m.kind === "family" && m.ref === f.id),
  );
  const availableGroups = [...Object.values(seating.groups), ...Object.values(seating.subgroups)].filter(
    (g) => !members.some((m) => m.kind === "group" && m.ref === g.id),
  );

  return (
    <>
      <ul className="mb-2 flex flex-wrap gap-1.5">
        {members.map((member, index) => (
          <li key={index}>
            <GuestChip name={memberDescriptor(member, guests, seating, customRoles, event)} onRemove={() => onRemove(index)} />
          </li>
        ))}
        {members.length === 0 && <li className="text-sm text-slate">Nobody added yet.</li>}
      </ul>

      {!(hasRole("a") && hasRole("b")) && (
        <div className="mb-2">
          <Button
            icon={Heart}
            tone="primary"
            onClick={() =>
              onAdd((["a", "b"] as const).filter((role) => !hasRole(role)).map((ref) => ({ kind: "role", ref })))
            }
          >
            + The couple
          </Button>
        </div>
      )}

      <ul className="mb-2 flex flex-wrap gap-1.5">
        {availableRoles.map((role) => (
          <li key={role}>
            <QuickAddChip label={roleLabel(role, event)} onClick={() => onAdd([{ kind: "role", ref: role }])} />
          </li>
        ))}
        {availableCustomRoles.map((r) => (
          <li key={r.id}>
            <QuickAddChip label={r.name} onClick={() => onAdd([{ kind: "customRole", ref: r.id }])} />
          </li>
        ))}
        {availableFamilies.map((f) => (
          <li key={f.id}>
            <QuickAddChip label={f.name} onClick={() => onAdd([{ kind: "family", ref: f.id }])} />
          </li>
        ))}
        {availableGroups.map((g) => (
          <li key={g.id}>
            <QuickAddChip label={g.name} onClick={() => onAdd([{ kind: "group", ref: g.id }])} />
          </li>
        ))}
      </ul>

      <GuestPicker
        guests={guests}
        exclude={members.filter((m) => m.kind === "guest").map((m) => m.ref)}
        onPick={(guestId) => onAdd([{ kind: "guest", ref: guestId }])}
      />

      <div className="mt-2 flex gap-2">
        <TextField value={textValue} onChange={setTextValue} placeholder={textPlaceholder} />
        <Button
          tone="quiet"
          onClick={() => {
            if (!textValue.trim()) return;
            onAdd([{ kind: "text", ref: textValue.trim() }]);
            setTextValue("");
          }}
        >
          Add
        </Button>
      </div>
    </>
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
