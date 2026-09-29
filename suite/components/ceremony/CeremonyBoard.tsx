"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Copy, ListOrdered, Music, Plus, Printer, Trash2, Wand2 } from "lucide-react";
import type { Event as WeddingEvent } from "@jfrusher/trousseau";
import { formatClock } from "@/apps/cadence/core/time/minutes";
import { Button, Check, Empty, IconButton, Panel, Segmented, SelectField, TextArea, TextField } from "@/components/ui/controls";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToolUndo } from "@/components/shell/ToolUndo";
import { MemberPicker } from "@/components/cast/MemberPicker";
import { SongFields } from "./SongFields";
import { resolveMembers, type MemberProblem } from "@/lib/cast/resolve";
import {
  addGroup,
  addMembers,
  addMoment,
  addMomentMembers,
  addWitnesses,
  blankSong,
  moveGroup,
  moveMoment,
  patchGroup,
  patchMoment,
  removeGroup,
  removeMember,
  removeMoment,
  removeMomentMember,
  removeWitness,
  setFacts,
} from "@/lib/ceremony/actions";
import { ceremonyChecks, ceremonyPlace, lengthOf, needsApproval, overrun, startTimes } from "@/lib/ceremony/checks";
import { MOMENT_KIND_NAMES, newMoment } from "@/lib/ceremony/moments";
import { musicCues, songName, songPlaying } from "@/lib/ceremony/music";
import { suggestOrder } from "@/lib/ceremony/propose";
import { FORMATION_WORDS, orderRows, orderText, processionalRows } from "@/lib/ceremony/rows";
import { CEREMONY_KIND_NAMES, suggestService } from "@/lib/ceremony/service";
import { download } from "@/lib/data/file";
import { sideLabel } from "@/lib/model/partners";
import { dayPlaces, type Place } from "@/lib/model/slices";
import { useCast, useCeremony, useEvent, useGuests, useSeating, useStatus, useWriters } from "@/lib/model/useSuite";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import {
  CEREMONY_KINDS,
  MOMENT_KINDS,
  type CastSlice,
  type Ceremony,
  type Formation,
  type Guest,
  type Moment,
  type MomentKind,
  type Seating,
  type Side,
  type WalkGroup,
} from "@/lib/model/types";

const CONTROL = "rounded border border-charcoal/15 bg-parchment px-2 py-1 text-sm text-charcoal focus:border-gold";

type Picked = { kind: "ceremony" } | { kind: "moment"; id: string } | { kind: "group"; id: string };
type Write = (next: Ceremony, options: { label: string }) => void;

/** What each kind of ceremony asks by law, in England and Wales, said where it is planned. */
const THE_LAW: Record<Ceremony["kind"], string[]> = {
  civil: [
    "Both of you give notice of marriage at a register office at least 29 days before, and no more than a year ahead.",
    "A civil ceremony has no religious content: no hymns or religious readings, and music with no religious words. Your registrar approves the readings and the music in advance — ask them how far ahead.",
    "Two witnesses sign the register.",
  ],
  religious: [
    "In the Church of England banns are usually read; other ceremonies need notice given at a register office at least 29 days before. Your officiant will say which.",
    "Two witnesses sign the register.",
  ],
  humanist: [
    "In England and Wales a humanist or celebrant-led ceremony is not the legal marriage: that is done separately, at a register office. In Scotland and Northern Ireland a humanist ceremony can be.",
  ],
  other: ["Ask your officiant what the law asks of your ceremony: notice, the words that must be said, and who signs."],
};

/** What a moment's words are, for the label on the box they are typed in. */
const WORDS_LABEL: Partial<Record<MomentKind, string>> = {
  reading: "The reading",
  vows: "The vows",
  welcome: "The words",
  words: "The words",
  declaration: "The words",
};

/**
 * The ceremony: its kind and officiant, the order of service with its music
 * and words, and the processional. It keeps no copy of anything — it reads
 * the wedding and writes it, on the wedding's one history — its people come
 * from the one cast Group shots uses, and where and when it is come from the
 * Timeline's block.
 */
export function CeremonyBoard() {
  const status = useStatus();
  const event = useEvent();
  const guests = useGuests();
  const seating = useSeating();
  const cast = useCast();
  const ceremony = useCeremony();
  const places = useTrousseauStore((s) => dayPlaces(s.doc));
  const { setCeremony } = useWriters();
  const [picked, setPicked] = useState<Picked>({ kind: "ceremony" });
  const [adding, setAdding] = useState<MomentKind>("reading");
  const [note, setNote] = useState<string | null>(null);

  if (status !== "ready") return null;

  const { order, processional } = ceremony;
  const { place, lost } = ceremonyPlace(ceremony, places);
  const times = startTimes(order, place?.startMin ?? 0);
  const checks = ceremonyChecks(ceremony);
  const minutes = lengthOf(order);
  const over = overrun(ceremony, place);
  const resolve = (group: { label: string; members: WalkGroup["members"] }) =>
    resolveMembers(group, guests, seating, cast.roles, cast.customRoles, event);
  const stem = (event.coupleNames || "wedding").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wedding";
  const rows = () => orderRows(ceremony, guests, seating, cast, event, place);
  const troubleCount = checks.unapproved + checks.witnessesShort + (checks.processionalMissing ? 1 : 0) + (lost ? 1 : 0);

  const print = async (what: "running-order" | "music" | "order-of-service" | "processional") => {
    setNote(null);
    try {
      const { browserFontSource } = await import("@/apps/brigade/render/pdf/fontSource");
      const fontSource = browserFontSource();
      const generatedOn = `Made with Trousseau, ${new Date().toLocaleDateString()}`;
      let bytes: Uint8Array;
      if (what === "running-order") {
        const { renderRunningOrder } = await import("@/lib/ceremony/render/pdf/runningOrder");
        bytes = await renderRunningOrder(rows(), { fontSource, coupleNames: event.coupleNames, officiant: ceremony.officiant, where: place, generatedOn });
      } else if (what === "music") {
        const { renderMusicSheet } = await import("@/lib/ceremony/render/pdf/musicSheet");
        const labels = new Map(processionalRows(processional, guests, seating, cast, event).map((row, i) => [processional[i]!.id, row.label]));
        bytes = await renderMusicSheet(musicCues(ceremony, (id) => labels.get(id) ?? "A group"), { fontSource, coupleNames: event.coupleNames, generatedOn });
      } else if (what === "order-of-service") {
        const { renderOrderOfService } = await import("@/lib/ceremony/render/pdf/orderOfService");
        bytes = await renderOrderOfService(rows(), { fontSource, event, where: place });
      } else {
        const { renderProcessionalSheet } = await import("@/lib/ceremony/render/pdf/processionalSheet");
        bytes = await renderProcessionalSheet(processionalRows(processional, guests, seating, cast, event), {
          fontSource,
          coupleNames: event.coupleNames,
          generatedOn,
        });
      }
      download(`${stem}-${what}.pdf`, new Blob([bytes as BlobPart], { type: "application/pdf" }));
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "The page could not be made.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(orderText(rows(), event));
      setNote("Copied — paste it into an email to your officiant or the wedding party.");
    } catch {
      setNote("This browser would not copy. Print the running order instead.");
    }
  };

  const addPart = () => {
    const moment = newMoment(adding);
    setCeremony(addMoment(ceremony, moment), { label: "adding to the order" });
    setPicked({ kind: "moment", id: moment.id });
  };

  const addWalkers = () => {
    const next = addGroup(ceremony);
    setCeremony(next, { label: "adding a group" });
    setPicked({ kind: "group", id: next.processional[next.processional.length - 1]!.id });
  };

  const selectedMoment = picked.kind === "moment" ? order.find((moment) => moment.id === picked.id) ?? null : null;
  const selectedGroup = picked.kind === "group" ? processional.find((group) => group.id === picked.id) ?? null : null;

  return (
    <div className="flex h-[calc(100dvh-var(--shell-header-h))]">
      <ToolUndo />
      <div data-tour="ceremony.order" className="flex w-96 shrink-0 flex-col overflow-y-auto border-r border-charcoal/10">
        {(order.length > 0 || processional.length > 0) && (
          <div className="flex flex-wrap gap-2 border-b border-charcoal/10 p-3">
            {order.length > 0 && (
              <>
                <Button icon={ListOrdered} onClick={() => void print("running-order")}>
                  Running order
                </Button>
                <Button icon={Music} onClick={() => void print("music")}>
                  Music
                </Button>
                <Button icon={BookOpen} onClick={() => void print("order-of-service")}>
                  Order of service
                </Button>
                <Button icon={Copy} onClick={() => void copy()}>
                  Copy as text
                </Button>
              </>
            )}
            {processional.length > 0 && (
              <Button icon={Printer} onClick={() => void print("processional")}>
                Processional
              </Button>
            )}
          </div>
        )}
        {note && (
          <p role="status" className="border-b border-charcoal/10 px-3 py-2 text-xs text-slate">
            {note}
          </p>
        )}

        <div className="border-b border-charcoal/10 p-1.5">
          <button
            type="button"
            onClick={() => setPicked({ kind: "ceremony" })}
            className={`w-full rounded px-2 py-1.5 text-left ${picked.kind === "ceremony" ? "bg-stone" : "hover:bg-stone/50"}`}
          >
            <span className="block text-sm text-charcoal">
              The ceremony
              {troubleCount > 0 && <span className="ml-1 text-danger">●</span>}
            </span>
            <span className="block truncate text-xs text-slate">
              {CEREMONY_KIND_NAMES[ceremony.kind]} ·{" "}
              {lost ? "its part of the day has gone" : place ? `${formatClock(place.startMin)}, ${place.location || place.label}` : "not on the day yet"}
            </span>
          </button>
        </div>

        <section aria-labelledby="order-heading" className="border-b border-charcoal/10 p-1.5">
          <div className="flex items-baseline justify-between px-2 pt-1">
            <h2 id="order-heading" className="text-xs tracking-widest text-slate uppercase">
              The order of service
            </h2>
            {minutes > 0 && (
              <span className={`text-xs ${over > 0 ? "text-danger" : "text-slate"}`}>
                {minutes} min{place ? ` of ${place.endMin - place.startMin}` : ""}
              </span>
            )}
          </div>
          {order.length === 0 ? (
            <div className="p-2">
              <Empty>Nothing in the order yet. Start from the usual order for your kind of ceremony, and change anything in it.</Empty>
              <div className="mt-2">
                <Button icon={Wand2} onClick={() => setCeremony({ ...ceremony, order: suggestService(ceremony.kind) }, { label: "suggesting an order of service" })}>
                  Suggest an order of service
                </Button>
              </div>
            </div>
          ) : (
            <ol aria-label="The order of service">
              {order.map((moment, index) => {
                const trouble = moment.members.length > 0 && resolve({ label: moment.title, members: moment.members }).problems.length > 0;
                const at = times[index];
                return (
                  <li
                    key={moment.id}
                    className={`flex items-start gap-1 rounded px-2 py-1.5 ${picked.kind === "moment" && picked.id === moment.id ? "bg-stone" : "hover:bg-stone/50"}`}
                  >
                    <button type="button" onClick={() => setPicked({ kind: "moment", id: moment.id })} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm text-charcoal">
                        {place && <span className="mr-1.5 text-xs text-slate tabular-nums">{at === null ? "Before" : formatClock(at ?? 0)}</span>}
                        {index + 1}. {moment.title || "A moment"}
                        {trouble && <span className="ml-1 text-danger">●</span>}
                      </span>
                      {(moment.song || moment.cue) && (
                        <span className="block truncate text-xs text-slate">
                          {[moment.song && `♪ ${songName(moment.song)}`, moment.cue].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </button>
                    <IconButton icon={ArrowUp} label={`Move ${moment.title || "this"} earlier`} onClick={() => setCeremony(moveMoment(ceremony, index, index - 1), { label: "changing the order" })} />
                    <IconButton icon={ArrowDown} label={`Move ${moment.title || "this"} later`} onClick={() => setCeremony(moveMoment(ceremony, index, index + 1), { label: "changing the order" })} />
                  </li>
                );
              })}
            </ol>
          )}
          {order.length > 0 && (
            <div className="flex gap-2 p-2">
              <select aria-label="What to add" value={adding} onChange={(event) => setAdding(event.target.value as MomentKind)} className={`${CONTROL} min-w-0 flex-1`}>
                {MOMENT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {MOMENT_KIND_NAMES[kind]}
                  </option>
                ))}
              </select>
              <Button icon={Plus} onClick={addPart}>
                Add
              </Button>
            </div>
          )}
        </section>

        <section aria-labelledby="processional-heading" className="p-1.5">
          <h2 id="processional-heading" className="px-2 pt-1 text-xs tracking-widest text-slate uppercase">
            The processional
          </h2>
          {processional.length === 0 ? (
            <div className="p-2">
              <Empty>
                Nobody walking yet. Suggest an order from who&rsquo;s who — the officiant, grandparents, parents, the wedding parties, then the
                two of you — or add groups one at a time.
              </Empty>
            </div>
          ) : (
            <ol aria-label="The processional">
              {processional.map((group, index) => {
                const resolved = resolve(group);
                return (
                  <li
                    key={group.id}
                    className={`flex items-start gap-1 rounded px-2 py-1.5 ${picked.kind === "group" && picked.id === group.id ? "bg-stone" : "hover:bg-stone/50"}`}
                  >
                    <button type="button" onClick={() => setPicked({ kind: "group", id: group.id })} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm text-charcoal">
                        {index + 1}. {resolved.label}
                        {resolved.problems.length > 0 && <span className="ml-1 text-danger">●</span>}
                      </span>
                      <span className="block truncate text-xs text-slate">
                        {[FORMATION_WORDS[group.formation], group.song && `♪ ${songName(group.song)}`, group.cue].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                    <IconButton icon={ArrowUp} label={`Move ${resolved.label} earlier`} onClick={() => setCeremony(moveGroup(ceremony, index, index - 1), { label: "changing the processional" })} />
                    <IconButton icon={ArrowDown} label={`Move ${resolved.label} later`} onClick={() => setCeremony(moveGroup(ceremony, index, index + 1), { label: "changing the processional" })} />
                  </li>
                );
              })}
            </ol>
          )}
          <div className="flex flex-wrap gap-2 p-2">
            <Button icon={Plus} onClick={addWalkers}>
              Add a group
            </Button>
            {processional.length === 0 && (
              <Button icon={Wand2} onClick={() => setCeremony({ ...ceremony, processional: suggestOrder(cast) }, { label: "suggesting who walks" })}>
                Suggest an order
              </Button>
            )}
          </div>
        </section>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        {selectedMoment ? (
          <MomentInspector
            key={selectedMoment.id}
            moment={selectedMoment}
            ceremony={ceremony}
            cast={cast}
            guests={guests}
            seating={seating}
            event={event}
            problems={selectedMoment.members.length > 0 ? resolve({ label: selectedMoment.title, members: selectedMoment.members }).problems : []}
            onChange={setCeremony}
            onRemoved={() => setPicked({ kind: "ceremony" })}
          />
        ) : selectedGroup ? (
          <GroupInspector
            key={selectedGroup.id}
            group={selectedGroup}
            ceremony={ceremony}
            cast={cast}
            guests={guests}
            seating={seating}
            event={event}
            problems={resolve(selectedGroup).problems}
            onChange={setCeremony}
            onRemoved={() => setPicked({ kind: "ceremony" })}
          />
        ) : (
          <CeremonyInspector
            ceremony={ceremony}
            cast={cast}
            guests={guests}
            seating={seating}
            event={event}
            places={places}
            lost={lost}
            over={over}
            onChange={setCeremony}
            groupLabel={(id) => {
              const group = processional.find((entry) => entry.id === id);
              return group ? resolve(group).label : "A group";
            }}
          />
        )}
      </div>
    </div>
  );
}

function CeremonyInspector({
  ceremony,
  cast,
  guests,
  seating,
  event,
  places,
  lost,
  over,
  onChange,
  groupLabel,
}: {
  ceremony: Ceremony;
  cast: CastSlice;
  guests: Record<string, Guest>;
  seating: Seating;
  event: WeddingEvent;
  places: ReadonlyMap<string, Place>;
  lost: boolean;
  over: number;
  onChange: Write;
  groupLabel: (groupId: string) => string;
}) {
  const checks = ceremonyChecks(ceremony);
  const blocks = [...places.entries()].sort(([, a], [, b]) => a.startMin - b.startMin);
  const cues = musicCues(ceremony, groupLabel);
  const facts = (patch: Parameters<typeof setFacts>[1], label: string) => onChange(setFacts(ceremony, patch), { label });
  const problems = [
    lost && "The part of the day the ceremony was on is no longer on the Timeline.",
    over > 0 && `The order runs ${over} minutes longer than its part of the day.`,
    checks.witnessesShort > 0 && `${checks.witnessesShort === 2 ? "Two witnesses" : "One more witness"} still to name.`,
    checks.unapproved > 0 && `${checks.unapproved} ${checks.unapproved === 1 ? "reading or piece of music" : "readings and pieces of music"} not yet approved by the registrar.`,
    checks.processionalMissing && "The processional is not in the order of service: add it where they walk.",
  ].filter((problem): problem is string => typeof problem === "string");

  return (
    <div className="flex flex-col gap-4 p-4">
      {problems.length > 0 && (
        <ul aria-label="Still to do" className="rounded border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-charcoal">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      <Panel title="The ceremony">
        <div className="flex flex-col gap-3">
          <SelectField
            label="What kind of ceremony"
            value={ceremony.kind}
            onChange={(kind) => facts({ kind }, "the kind of ceremony")}
            options={CEREMONY_KINDS.map((kind) => ({ value: kind, label: CEREMONY_KIND_NAMES[kind] }))}
          />
          <SelectField
            label="Its part of the day"
            value={ceremony.blockId !== null && places.has(ceremony.blockId) ? ceremony.blockId : ""}
            onChange={(blockId) => facts({ blockId: blockId || null }, "when the ceremony is")}
            options={[
              { value: "", label: "Not chosen yet" },
              ...blocks.map(([id, place]) => ({ value: id, label: `${formatClock(place.startMin)} · ${place.label}${place.location ? ` · ${place.location}` : ""}` })),
            ]}
          />
          <TextField label="Who leads it" value={ceremony.officiant} onChange={(officiant) => facts({ officiant }, "the officiant")} placeholder="e.g. Mrs Ada Jones, the registrar" />
          <TextArea label="Notes for the day" value={ceremony.notes} onChange={(notes) => facts({ notes }, "the ceremony's notes")} />
        </div>
      </Panel>

      <Panel title="Witnesses">
        <MemberPicker
          members={ceremony.witnesses}
          customRoles={cast.customRoles}
          guests={guests}
          seating={seating}
          event={event}
          onAdd={(members) => onChange(addWitnesses(ceremony, members), { label: "the witnesses" })}
          onRemove={(index) => onChange(removeWitness(ceremony, index), { label: "the witnesses" })}
          textPlaceholder="Or type a name"
        />
      </Panel>

      <Panel title="What the law asks">
        <ul className="list-disc pl-5 text-sm text-slate">
          {THE_LAW[ceremony.kind].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="The music, in order">
        {cues.length === 0 ? (
          <Empty>No music chosen yet. Add it to a part of the order, or to a group in the processional.</Empty>
        ) : (
          <ol aria-label="The music, in order" className="flex flex-col gap-1.5 text-sm">
            {cues.map((cue, index) => (
              <li key={index}>
                <span className="text-charcoal">{songName(cue.song)}</span>
                <span className="block text-xs text-slate">
                  {[cue.where, cue.cue && `cue: ${cue.cue}`, songPlaying(cue.song)].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function MomentInspector({
  moment,
  ceremony,
  cast,
  guests,
  seating,
  event,
  problems,
  onChange,
  onRemoved,
}: {
  moment: Moment;
  ceremony: Ceremony;
  cast: CastSlice;
  guests: Record<string, Guest>;
  seating: Seating;
  event: WeddingEvent;
  problems: MemberProblem[];
  onChange: Write;
  onRemoved: () => void;
}) {
  const patch = (change: Partial<Omit<Moment, "id">>, label: string) => onChange(patchMoment(ceremony, moment.id, change), { label });
  const approving = needsApproval(ceremony).some((entry) => entry.id === moment.id);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Panel title="This part">
        <div className="flex flex-col gap-3">
          <SelectField
            label="What it is"
            value={moment.kind}
            onChange={(kind) => patch({ kind }, "what a part is")}
            options={MOMENT_KINDS.map((kind) => ({ value: kind, label: MOMENT_KIND_NAMES[kind] }))}
          />
          <TextField label="Title" value={moment.title} onChange={(title) => patch({ title }, "a part's title")} placeholder="e.g. Sonnet 116, read by Aunt Jo" />
          {moment.kind === "processional" && <p className="text-sm text-slate">Who walks, and to what, is in the processional on the left.</p>}
        </div>
      </Panel>

      {moment.kind !== "processional" && (
        <Panel title="Who leads it">
          {problems.length > 0 && (
            <ul className="mb-2 text-sm text-danger">
              {problems.map((problem, index) => (
                <li key={index}>{describe(problem)}</li>
              ))}
            </ul>
          )}
          <MemberPicker
            members={moment.members}
            customRoles={cast.customRoles}
            guests={guests}
            seating={seating}
            event={event}
            onAdd={(members) => onChange(addMomentMembers(ceremony, moment.id, members), { label: "who leads a part" })}
            onRemove={(index) => onChange(removeMomentMember(ceremony, moment.id, index), { label: "who leads a part" })}
            textPlaceholder="Or type a name, e.g. the registrar"
          />
        </Panel>
      )}

      <Panel title="When">
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <NumberInput label="How many minutes" value={moment.minutes} onCommit={(minutes) => patch({ minutes }, "how long a part is")} className={`${CONTROL} w-20`} />
            minutes
          </label>
          <TextField label="When it starts" value={moment.cue} onChange={(cue) => patch({ cue }, "a cue")} placeholder="e.g. at the line 'And I will love you still'" />
        </div>
      </Panel>

      <Panel
        title="Music"
        right={
          moment.song && (
            <Button tone="danger" onClick={() => patch({ song: null }, "the music")}>
              No music
            </Button>
          )
        }
      >
        {moment.song ? (
          <SongFields song={moment.song} onChange={(song) => patch({ song }, "the music")} />
        ) : (
          <Button icon={Music} onClick={() => patch({ song: blankSong() }, "the music")}>
            Add music
          </Button>
        )}
      </Panel>

      {moment.kind !== "processional" && moment.kind !== "music" && (
        <Panel title={WORDS_LABEL[moment.kind] ?? "Words"}>
          <TextArea value={moment.words} onChange={(words) => patch({ words }, "a part's words")} rows={6} />
        </Panel>
      )}

      <Panel title="On paper">
        <div className="flex flex-col gap-2">
          <Check
            label="Print its words and lyrics in full in the order of service"
            checked={moment.print}
            onChange={(print) => patch({ print }, "what the order of service shows")}
          />
          {approving && <Check label="Approved by the registrar" checked={moment.approved} onChange={(approved) => patch({ approved }, "the registrar's approval")} />}
          <TextArea label="Notes for the officiant and whoever runs the day" value={moment.notes} onChange={(notes) => patch({ notes }, "a part's notes")} />
        </div>
      </Panel>

      <div>
        <Button
          tone="danger"
          icon={Trash2}
          onClick={() => {
            onChange(removeMoment(ceremony, moment.id), { label: "removing a part" });
            onRemoved();
          }}
        >
          Take it out of the order
        </Button>
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
  onChange: Write;
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
        <TextField label="Label" value={group.label} onChange={(label) => patch({ label }, "a group's label")} placeholder="Leave blank to build it from who walks" />
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

      <Panel title="When they set off">
        <TextField label="Their cue" value={group.cue} onChange={(cue) => patch({ cue }, "a cue")} placeholder="e.g. at 'At last, my love has come along'" />
      </Panel>

      <Panel
        title="Music"
        right={
          group.song && (
            <Button tone="danger" onClick={() => patch({ song: null }, "the music")}>
              Carry on with the last piece
            </Button>
          )
        }
      >
        {group.song ? (
          <SongFields song={group.song} onChange={(song) => patch({ song }, "the music")} />
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-slate">Whatever is playing carries on as they walk.</p>
            <Button icon={Music} onClick={() => patch({ song: blankSong() }, "the music")}>
              A new piece starts with them
            </Button>
          </div>
        )}
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
      return "Nobody is named yet.";
  }
}
