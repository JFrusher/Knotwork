import { useState } from "react";
import type { OutputId } from "../core/model/types";
import { tagLabel, usedTags } from "../core/model/tags";
import { blockingConflicts } from "../core/schedule/conflicts";
import { calendar } from "../render/ics/calendar";
import { browserFontSource } from "@/lib/pdf/fontSource";
import { getBlob } from "../state/blobStore";
import { useSchedule, useStore, useTimelineDoc } from "../state/store";
import { Button } from "@/components/ui/fields";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import styles from "./ExportBar.module.css";

const FILENAMES: Record<OutputId, string> = {
  "run-sheet": "run-sheet",
  "call-sheet": "call-sheets",
  "order-of-day": "order-of-the-day",
  "contact-sheet": "contact-sheet",
};

export function ExportBar() {
  const doc = useTimelineDoc();
  const schedule = useSchedule();
  const output = useStore((state) => state.ui.sheetOutput);
  const setUi = useStore((state) => state.setUi);
  const setNotice = useStore((state) => state.setNotice);
  const [busy, setBusy] = useState(false);
  // "" is the whole day; otherwise one tag's part of it.
  const [calendarTag, setCalendarTag] = useState("");
  // The wedding's own date. The timeline's has a placeholder until one is set,
  // and a calendar on the wrong day is worse than none.
  const weddingDate = useKnotworkStore((state) => state.doc.event.date);

  const blocking = blockingConflicts(schedule.conflicts);
  const empty = doc.blocks.length === 0;
  const reason = empty
    ? "Add a block to the day first."
    : blocking.length > 0
      ? `Fix ${blocking.length} clash${blocking.length === 1 ? "" : "es"} first — a printed sheet that contradicts itself is worse than none.`
      : null;

  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const fileStem = slug(doc.day.coupleNames) || "cadence";

  const save = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const calendarReason = reason ?? (weddingDate ? null : "Set the wedding's date first: a calendar needs the day it is on.");
  const tags = usedTags(doc);

  const downloadCalendar = () => {
    const tag = calendarTag === "" ? undefined : calendarTag;
    const text = calendar(doc, { date: weddingDate, now: new Date(), ...(tag === undefined ? {} : { tag }) });
    save(
      new Blob([text], { type: "text/calendar;charset=utf-8" }),
      `${fileStem}-${tag === undefined ? "the-day" : slug(tagLabel(doc, tag)) || "tag"}.ics`,
    );
  };

  const download = async (piece: OutputId | "timeline") => {
    setBusy(true);
    try {
      const uploaded = new Map<string, Uint8Array>();
      for (const font of doc.fonts) {
        const blob = await getBlob(font.blobKey).catch(() => null);
        if (blob) uploaded.set(font.family, new Uint8Array(await blob.arrayBuffer()));
      }

      const fontSource = browserFontSource(uploaded);
      const generatedOn = `Made with Cadence, ${new Date().toLocaleDateString()}`;
      const bytes =
        piece === "timeline"
          ? await (await import("../render/pdf/timeline")).renderTimeline(doc, { fontSource, generatedOn })
          : piece === "run-sheet"
            ? await (await import("../render/pdf/runSheet")).renderRunSheet(doc, { fontSource, generatedOn })
            : piece === "call-sheet"
              ? await (await import("../render/pdf/callSheet")).renderAllCallSheets(doc, { fontSource, generatedOn })
              : piece === "order-of-day"
                ? await (await import("../render/pdf/orderOfDay")).renderOrderOfDay(doc, { fontSource })
                : await (await import("../render/pdf/contactSheet")).renderContactSheet(doc, { fontSource, generatedOn });

      save(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${fileStem}-${piece === "timeline" ? "timeline" : FILENAMES[piece]}.pdf`,
      );
    } catch (error) {
      setNotice(`The PDF could not be made: ${error instanceof Error ? error.message : "unknown problem"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-tour="timeline.export" className={styles.bar}>
      <div className={styles.group}>
        <select
          className={styles.select}
          value={output}
          aria-label="Printed piece"
          onChange={(event) => setUi({ sheetOutput: event.target.value as OutputId })}
        >
          {doc.outputs.map((spec) => (
            <option key={spec.id} value={spec.id}>
              {spec.label}
            </option>
          ))}
        </select>

        <Button
          variant="primary"
          disabled={busy || reason !== null}
          onClick={() => void download(output)}
          {...(reason === null ? {} : { title: reason })}
        >
          {busy ? "Making the PDF…" : "Download PDF"}
        </Button>

        <Button
          disabled={busy || reason !== null}
          onClick={() => void download("timeline")}
          title={reason ?? "The whole day on one page, lane by lane."}
        >
          Download timeline
        </Button>
      </div>

      <div className={styles.group}>
        <select
          className={styles.select}
          value={calendarTag}
          aria-label="Calendar for"
          onChange={(event) => setCalendarTag(event.target.value)}
        >
          <option value="">The whole day</option>
          {tags.map((summary) => (
            <option key={summary.tag} value={summary.tag}>
              {tagLabel(doc, summary.tag)}
            </option>
          ))}
        </select>
        <Button
          disabled={calendarReason !== null}
          onClick={downloadCalendar}
          title={calendarReason ?? "For a phone's calendar: the whole day, or one supplier's part of it."}
        >
          Download calendar
        </Button>
      </div>

      {(reason ?? calendarReason) && <span className={styles.reason}>{reason ?? calendarReason}</span>}
    </div>
  );
}
