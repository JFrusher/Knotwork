import { useRevealOnPhone } from "@/components/shell/LandscapeGate";
import { useStore } from "../state/store";
import { CrewPanel } from "./panels/CrewPanel";
import { DayPanel } from "./panels/DayPanel";
import { JobPanel } from "./panels/JobPanel";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  // On a phone the panels sit below the board: picking a job takes you to them.
  const aside = useRevealOnPhone<HTMLElement>(useStore((s) => s.selectedJobId));
  return (
    <aside ref={aside} className={styles.sidebar}>
      <DayPanel />
      <JobPanel />
      <CrewPanel />
    </aside>
  );
}
