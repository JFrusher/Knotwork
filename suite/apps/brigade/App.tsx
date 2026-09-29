"use client";

import { useSelectFromAddress } from "@/components/shell/useSelectFromAddress";
import { Board } from "./render/screen/Board";
import { useBrigadeDoc, useStore } from "./state/store";
import { Announcer } from "./ui/Announcer";
import { Button } from "@/components/ui/fields";
import { ChromeFill } from "@/components/shell/chrome";
import { ToolUndo } from "@/components/shell/ToolUndo";
import { ExportBar } from "./ui/ExportBar";
import { Sidebar } from "./ui/Sidebar";
import { WarningsList } from "./ui/WarningsList";
import styles from "./App.module.css";

export function App() {
  const doc = useBrigadeDoc();
  const notice = useStore((state) => state.notice);
  const filter = useStore((state) => state.filter);
  const setFilter = useStore((state) => state.setFilter);
  const setNotice = useStore((state) => state.setNotice);

  // Delegation keeps no copy and no history of its own: its edits are on the
  // wedding's, so that is the one the header's undo drives. The stack is
  // shared, so saying what the next undo takes back is what makes it safe.

  // A link to one job — the command palette's — opens on it.
  useSelectFromAddress(useStore.getState().select);

  // The jobs on the day. A task before it with nobody named is the couple's
  // own, kept on the Checklist, and is not a gap in the crew.
  const onTheDay = doc.jobs.filter((job) => job.blockId !== null);
  const unassigned = onTheDay.filter((job) => job.personIds.length === 0).length;

  return (
    <div className={styles.app}>
      {/*
        * Brigade's own header used to sit here, under the suite's, repeating a
        * wordmark and the couple's names the shell already knows. There is one
        * header now; the coverage reading and the filter go into it, because
        * how many jobs still have nobody on them is the thing you keep glancing
        * at while you work.
        */}
      <ChromeFill name="tool-actions" tokens="brigade-tokens">
        {/* Nothing to report leaves nothing behind, rather than an empty
            styled span sitting in the header as a stray mark. */}
        {onTheDay.length > 0 && (
          <span className={unassigned > 0 ? styles.over : styles.slack}>
            {unassigned > 0
              ? `${unassigned} of ${onTheDay.length} jobs have nobody`
              : `${onTheDay.length} jobs, all covered`}
          </span>
        )}
        <Button
          variant={filter.unassignedOnly ? "primary" : "quiet"}
          onClick={() => setFilter({ unassignedOnly: !filter.unassignedOnly })}
          title="Show only the jobs nobody is named on"
        >
          Unassigned only
        </Button>
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
          <Board />
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
