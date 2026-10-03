"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, IconButton, Panel, TextField } from "@/components/ui/controls";
import { GuestChip, GuestPicker } from "@/components/cast/GuestPicker";
import { guestName } from "@/lib/model/slices";
import type { Event as WeddingEvent } from "@jfrusher/knotwork";
import { roleLabel } from "@/lib/model/partners";
import { CAST_ROLES, SINGLE_ROLES, type CastSlice, type Guest } from "@/lib/model/types";
import { addCustomRole, removeCustomRole, renameCustomRole, setCastRole, setCustomRoleMembers } from "@/lib/cast/actions";

/** Who is who, shared with Ceremony: a mother named here walks there too. */
export function CastPanel({
  cast,
  guests,
  event,
  onChange,
}: {
  cast: CastSlice;
  guests: Record<string, Guest>;
  event: WeddingEvent;
  onChange: (next: CastSlice) => void;
}) {
  const [newRoleName, setNewRoleName] = useState("");

  return (
    <div className="flex flex-col gap-4 p-4">
      {CAST_ROLES.map((role) => {
        const chosen = cast.roles[role];
        const single = SINGLE_ROLES.has(role);
        return (
          <Panel key={role} title={roleLabel(role, event)}>
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {chosen.map((guestId) => (
                <li key={guestId}>
                  <GuestChip
                    name={guests[guestId] ? guestName(guests[guestId]!) || "Unnamed guest" : "Deleted guest"}
                    onRemove={() => onChange(setCastRole(cast, role, chosen.filter((id) => id !== guestId)))}
                  />
                </li>
              ))}
              {chosen.length === 0 && <li className="text-sm text-slate">Not set yet.</li>}
            </ul>

            {(!single || chosen.length === 0) && (
              <GuestPicker
                guests={guests}
                exclude={chosen}
                onPick={(guestId) => onChange(setCastRole(cast, role, single ? [guestId] : [...chosen, guestId]))}
              />
            )}
          </Panel>
        );
      })}

      {cast.customRoles.map((role) => (
        <div key={role.id} className="rounded border border-charcoal/10 p-3">
          <div className="mb-2 flex items-center gap-2">
            <input
              aria-label="Role name"
              value={role.name}
              onChange={(e) => onChange(renameCustomRole(cast, role.id, e.target.value))}
              className="min-w-0 flex-1 bg-transparent text-xs tracking-widest text-slate uppercase"
            />
            <IconButton icon={Trash2} label={`Remove ${role.name}`} tone="danger" onClick={() => onChange(removeCustomRole(cast, role.id))} />
          </div>
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {role.guestIds.map((guestId) => (
              <li key={guestId}>
                <GuestChip
                  name={guests[guestId] ? guestName(guests[guestId]!) || "Unnamed guest" : "Deleted guest"}
                  onRemove={() =>
                    onChange(setCustomRoleMembers(cast, role.id, role.guestIds.filter((id) => id !== guestId)))
                  }
                />
              </li>
            ))}
            {role.guestIds.length === 0 && <li className="text-sm text-slate">Not set yet.</li>}
          </ul>
          <GuestPicker
            guests={guests}
            exclude={role.guestIds}
            onPick={(guestId) => onChange(setCustomRoleMembers(cast, role.id, [...role.guestIds, guestId]))}
          />
        </div>
      ))}

      <div className="flex gap-2">
        <TextField value={newRoleName} onChange={setNewRoleName} placeholder="e.g. Me and my family" />
        <Button
          tone="quiet"
          onClick={() => {
            if (!newRoleName.trim()) return;
            onChange(addCustomRole(cast, newRoleName.trim()));
            setNewRoleName("");
          }}
        >
          Add a role
        </Button>
      </div>
    </div>
  );
}
