"use client";

import { useEffect } from "react";
import { useSelectFromAddress } from "@/components/shell/useSelectFromAddress";
import { Presentation } from "./render/screen/Presentation";
import { Timeline } from "./render/screen/Timeline";
import { formatDuration } from "./core/time/minutes";
import { restoreFonts } from "./state/fontLoader";
import { spanOf } from "./render/screen/ticks";
import { ZOOM_STEP, currentDoc, useSchedule, useStore, useTimelineDoc } from "./state/store";
import { useKeyboard } from "./state/useKeyboard";
import { Announcer } from "./ui/Announcer";
import { Button } from "@/components/ui/fields";
import { ChromeFill } from "@/components/shell/chrome";
import { ToolUndo } from "@/components/shell/ToolUndo";
import { ExportBar } from "./ui/ExportBar";
import { Sidebar } from "./ui/Sidebar";
import { WarningsList } from "./ui/WarningsList";
import styles from "./App.module.css";

export function App() {
  const doc = useTimelineDoc();
  const schedule = useSchedule();
  const presentation = useStore((state) => state.ui.presentation);
  const notice = useStore((state) => state.notice);
  const setUi = useStore((state) => state.setUi);
  const setNotice = useStore((state) => state.setNotice);
  const zoomBy = useStore((state) => state.zoomBy);
  const fitDay = useStore((state) => state.fitDay);
  useKeyboard();

  // Timeline keeps no copy and no history of its own: its edits are on the
  // wedding's, so that is the one the header's undo drives. The stack is
  // shared, so saying what the next undo takes back is what makes it safe.

  // Uploaded faces are loaded once, for the fonts this day names.
  useEffect(() => {
    void restoreFonts(currentDoc().fonts).then((missing) => {
      if (missing.length > 0) setNotice(`Missing font${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
    });
  }, [setNotice]);
  // A link to one block — the command palette's — opens on it.
  useSelectFromAddress(useStore.getState().select);

  if (presentation) return <Presentation />;

  const curfew = schedule.slack.toCurfewMin;

  return (
    <div className={styles.app}>
      {/*
        * Cadence's own header used to sit here, under the suite's, with a
        * second wordmark and the couple's names the shell already knows. There
        * is one header now; what was in it that does something goes into it.
        *
        * The curfew reading travels with them. It is the one number in this bar
        * that is not a control — how much of the day is left — and it belongs
        * beside the day rather than buried in a panel.
        */}
      <ChromeFill name="tool-actions" tokens="cadence-tokens">
        {doc.blocks.length > 0 && (
          <span className={curfew < 0 ? styles.over : styles.slack}>
            {curfew < 0
              ? `${formatDuration(-curfew)} past curfew`
              : `${formatDuration(curfew)} before curfew`}
          </span>
        )}
        <span className={styles.zoom}>
          <Button variant="quiet" onClick={() => zoomBy(1 / ZOOM_STEP)} title="Zoom out">
            −
          </Button>
          <Button variant="quiet" onClick={() => zoomBy(ZOOM_STEP)} title="Zoom in">
            +
          </Button>
          <Button
            variant="quiet"
            title="Fit the whole day in view"
            onClick={() => {
              const span = spanOf(schedule.resolved, doc.day.curfewMin);
              const viewport = document.querySelector("[data-timeline]")?.clientHeight ?? 0;
              fitDay(viewport - 40, span.toMin - span.fromMin);
            }}
          >
            Fit day
          </Button>
        </span>
        <Button onClick={() => setUi({ presentation: true })}>Present</Button>
      </ChromeFill>
      <ToolUndo />

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
          <button type="button" className={styles.dismiss} onClick={() => setNotice(null)}>
            dismiss
          </button>
        </p>
      )}

      <div className={styles.body}>
        <Sidebar />
        <div className={styles.canvas}>
          <Timeline />
          <div className={styles.foot}>
            <WarningsList />
            <ExportBar />
          </div>
        </div>
      </div>

      <Announcer />
    </div>
  );
}
