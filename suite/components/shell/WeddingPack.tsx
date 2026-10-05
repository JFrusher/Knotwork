"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { KO_FI_URL } from "@/lib/support";
import type { PackSection } from "@/lib/export/weddingPack";
import { hiddenToolIds } from "@/lib/model/toolbox";
import { dayPlaces, readBar, readBoxes, readCast, readCeremony, readCrew, readGuests, readSeating, readShots, readTimeline } from "@/lib/model/slices";

/**
 * The one button that produces everything you carry on the day.
 *
 * It lives here rather than in any one tool because it is the only
 * thing in the suite that is not any one tool's job: the plan comes from the
 * room, the running order from the day, the ceremony's from Ceremony,
 * the jobs from the crew, the drinks from the bar, and the whole
 * point is that they are printed from the same wedding at the same moment.
 *
 * Sections are gathered one at a time and a failure is reported rather than
 * thrown away, because "your pack has no job sheets in it" is a useful thing to
 * be told while you still have time to find out why.
 */
export function WeddingPack() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const hasDay = useKnotworkStore((s) => readTimeline(s.doc).blocks.length > 0);
  const couple = useKnotworkStore((s) => s.doc.event.coupleNames);

  async function build() {
    setBusy(true);
    setNote(null);
    setProblem(null);

    const sections: PackSection[] = [];
    const missing: string[] = [];

    // Imported here rather than at the top of the file: each of these pulls in
    // a PDF library and a tool's whole rendering stack, and none of it is
    // wanted until somebody actually asks for a pack.
    for (const [title, make] of [
      ["The room", floorPlan],
      ["The day", runSheet],
      ["The ceremony", runningOrder],
      ["The jobs", jobList],
      ["The boxes", packingList],
      ["The drinks", drinksList],
      ["The shots", shotSheet],
    ] as const) {
      try {
        const bytes = await make();
        if (bytes) sections.push({ title, bytes });
        else missing.push(title.toLowerCase());
      } catch {
        missing.push(title.toLowerCase());
      }
    }

    if (sections.length === 0) {
      setProblem("Nothing to print yet. Start with the room or the day.");
      setBusy(false);
      return;
    }

    // Lazily too: `assemblePack` is where pdf-lib comes in. Imported at the
    // top of the file, it put the PDF library in the front page's first load.
    const { assemblePack } = await import("@/lib/export/weddingPack");
    const pack = await assemblePack(sections);
    const name = (couple || "wedding").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const url = URL.createObjectURL(new Blob([pack.bytes as BlobPart], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name || "wedding"}-pack.pdf`;
    link.click();
    URL.revokeObjectURL(url);

    setNote(
      `${pack.contents.map((part) => `${part.title} (${part.pages})`).join(", ")}.` +
        (missing.length > 0 ? ` Left out: ${missing.join(", ")}.` : ""),
    );
    setBusy(false);
  }

  return (
    <div data-tour="shell.pack" className="rounded-lg border border-charcoal/10 bg-stone/60 p-6">
      <h2 className="mb-1 text-lg text-charcoal">The wedding pack</h2>
      <p className="mb-4 max-w-prose text-sm text-slate">
        The floor plan, the run sheet, the job list and the group shot list — and the processional,
        the packing list and the drinks to buy, from the tools you use — as one document, printed
        from the wedding as it stands right now. Place cards are a separate print — they
        go on card stock, not in a binder.
      </p>

      <button
        type="button"
        onClick={() => void build()}
        disabled={busy || !hasDay}
        className="inline-flex items-center gap-2 rounded border border-gold bg-gold/15 px-4 py-2 text-sm text-charcoal transition hover:bg-gold/25 disabled:pointer-events-none disabled:opacity-40"
      >
        <FileDown size={16} />
        {busy ? "Making the pack…" : "Download the pack"}
      </button>

      {!hasDay && (
        <p className="mt-3 text-xs text-slate">
          There is no day planned yet, and the pack is mostly the day.
        </p>
      )}
      {note && <p className="mt-3 text-xs text-slate">{note}</p>}
      {/* Said only once something has been made, and never in the way of it. */}
      {note && (
        <p className="mt-2 text-xs text-slate">
          If Knotwork saved you some work,{" "}
          <a href={KO_FI_URL} className="underline underline-offset-2 hover:text-charcoal">
            a coffee on Ko-fi
          </a>{" "}
          helps keep it free.
        </p>
      )}
      {problem && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {problem}
        </p>
      )}
    </div>
  );
}

/** The room as Place cards draws it: the wedding's own floor plan, on A4. */
async function floorPlan(): Promise<Uint8Array | null> {
  const { packFloorPlanPdf } = await import("@/apps/plaque/export/packFloorPlan");
  return packFloorPlanPdf(useKnotworkStore.getState());
}

async function runSheet(): Promise<Uint8Array | null> {
  const [{ renderRunSheet }, { browserFontSource }, { getBlob }] = await Promise.all([
    import("@/apps/cadence/render/pdf/runSheet"),
    import("@/apps/cadence/render/pdf/fontSource"),
    import("@/apps/cadence/state/blobStore"),
  ]);
  const doc = readTimeline(useKnotworkStore.getState().doc);
  if (doc.blocks.length === 0) return null;

  // Any typeface uploaded for the printed pieces, by family name. Without this
  // the pack would quietly fall back to the bundled faces and look like a
  // different document to the one Cadence exports on its own.
  const uploaded = new Map<string, Uint8Array>();
  for (const font of doc.fonts) {
    const blob = await getBlob(font.blobKey).catch(() => null);
    if (blob) uploaded.set(font.family, new Uint8Array(await blob.arrayBuffer()));
  }

  return renderRunSheet(doc, {
    fontSource: browserFontSource(uploaded),
    generatedOn: `Made with Knotwork, ${new Date().toLocaleDateString()}`,
  });
}

async function jobList(): Promise<Uint8Array | null> {
  const [{ renderJobList }, { browserFontSource }, { readSlice }] = await Promise.all([
    import("@/apps/brigade/render/pdf/jobSheets"),
    import("@/apps/brigade/render/pdf/fontSource"),
    import("@/apps/brigade/state/sliceBridge"),
  ]);
  const doc = readSlice(useKnotworkStore.getState().doc);
  if (doc.jobs.length === 0) return null;

  return renderJobList(doc, {
    fontSource: browserFontSource(),
    generatedOn: `Made with Knotwork, ${new Date().toLocaleDateString()}`,
  });
}

/** The running order: the order of service, with the processional where they walk. */
async function runningOrder(): Promise<Uint8Array | null> {
  const { doc } = useKnotworkStore.getState();
  const ceremony = readCeremony(doc);
  if (ceremony.order.length === 0) return null;

  const [{ renderRunningOrder }, { browserFontSource }, { orderRows }, { ceremonyPlace }] = await Promise.all([
    import("@/lib/ceremony/render/pdf/runningOrder"),
    import("@/apps/brigade/render/pdf/fontSource"),
    import("@/lib/ceremony/rows"),
    import("@/lib/ceremony/checks"),
  ]);
  const { place } = ceremonyPlace(ceremony, dayPlaces(doc));

  return renderRunningOrder(orderRows(ceremony, readGuests(doc), readSeating(doc), readCast(doc), doc.event, place), {
    fontSource: browserFontSource(),
    coupleNames: doc.event.coupleNames,
    officiant: ceremony.officiant,
    where: place,
    generatedOn: `Made with Knotwork, ${new Date().toLocaleDateString()}`,
  });
}

async function drinksList(): Promise<Uint8Array | null> {
  const { doc } = useKnotworkStore.getState();
  // Worked out for any wedding with guests, so printed only for one using the Bar.
  if (hiddenToolIds(doc).has("bar")) return null;

  const [{ renderShoppingList }, { browserFontSource }, { forWords, shoppingList, spendWords }, { barSum }] = await Promise.all([
    import("@/lib/bar/render/pdf/shoppingList"),
    import("@/apps/brigade/render/pdf/fontSource"),
    import("@/lib/bar/rows"),
    import("@/lib/bar/sum"),
  ]);
  const sum = barSum(doc);
  const groups = shoppingList(readBar(doc), sum);
  if (groups.length === 0) return null;

  return renderShoppingList(groups, {
    fontSource: browserFontSource(),
    coupleNames: doc.event.coupleNames,
    forWhom: forWords(sum),
    spend: spendWords(sum),
    generatedOn: `Made with Knotwork, ${new Date().toLocaleDateString()}`,
  });
}

async function packingList(): Promise<Uint8Array | null> {
  const { doc } = useKnotworkStore.getState();
  const boxes = readBoxes(doc);
  if (boxes.boxes.length === 0) return null;

  const [{ renderPackingList }, { browserFontSource }, { boxRows }] = await Promise.all([
    import("@/lib/boxes/render/pdf/packingList"),
    import("@/apps/brigade/render/pdf/fontSource"),
    import("@/lib/boxes/rows"),
  ]);

  return renderPackingList(boxRows(boxes, dayPlaces(doc), readCrew(doc), readGuests(doc)), {
    fontSource: browserFontSource(),
    coupleNames: doc.event.coupleNames,
    generatedOn: `Made with Knotwork, ${new Date().toLocaleDateString()}`,
  });
}

async function shotSheet(): Promise<Uint8Array | null> {
  const { doc } = useKnotworkStore.getState();
  const shots = readShots(doc);
  const cast = readCast(doc);
  const total = shots.sections.reduce((sum, section) => sum + section.shots.length, 0);
  if (total === 0) return null;

  const [{ renderShotSheet }, { browserFontSource }] = await Promise.all([
    import("@/lib/ensemble/render/pdf/shotSheet"),
    import("@/apps/brigade/render/pdf/fontSource"),
  ]);

  return renderShotSheet(
    shots.sections,
    readGuests(doc),
    readSeating(doc),
    cast.roles,
    {
      fontSource: browserFontSource(),
      coupleNames: doc.event.coupleNames,
      partners: doc.event.partners,
      generatedOn: `Made with Knotwork, ${new Date().toLocaleDateString()}`,
    },
    cast.customRoles,
  );
}
