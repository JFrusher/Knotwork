"use client";

import { Panel, TextArea, TextField } from "@/components/ui/controls";
import { MemberPicker } from "@/components/cast/MemberPicker";
import { addMember, patchShot, removeMember } from "@/lib/ensemble/actions";
import type { Event as WeddingEvent } from "@jfrusher/trousseau";
import type { CastSlice, Guest, Seating, Shot, Shots } from "@/lib/model/types";

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
        <MemberPicker
          members={shot.members}
          customRoles={cast.customRoles}
          guests={guests}
          seating={seating}
          event={event}
          onAdd={(members) => onChange(members.reduce((next, member) => addMember(next, shot.id, member), shots))}
          onRemove={(index) => onChange(removeMember(shots, shot.id, index))}
          textPlaceholder="Or type something else, e.g. the dog"
        />
      </Panel>

      <Panel title="Notes">
        <TextArea value={shot.notes} onChange={(notes) => onChange(patchShot(shots, shot.id, { notes }))} />
      </Panel>
    </div>
  );
}
