import Link from "next/link";
import { formatClock } from "../../core/time/minutes";
import { resolveMembers } from "@/lib/cast/resolve";
import { startTimes } from "@/lib/ceremony/checks";
import { musicCues, songName, songPlaying } from "@/lib/ceremony/music";
import { readCast, readCeremony, readGuests, readSeating } from "@/lib/model/slices";
import { hiddenToolIds } from "@/lib/model/toolbox";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import styles from "./InspectorPanel.module.css";

/**
 * The ceremony's order and music, inside the Timeline block it is planned
 * for: what happens when, and what plays on what cue. Read-only — Ceremony
 * owns it, and is one click away — and read live, so a piece chosen there
 * shows here at once.
 */
export function CeremonyCues({ blockId, startMin }: { blockId: string; startMin: number }) {
  const doc = useKnotworkStore((state) => state.doc);
  const ceremony = readCeremony(doc);
  if (ceremony.blockId !== blockId || hiddenToolIds(doc).has("ceremony") || ceremony.order.length === 0) return null;

  const guests = readGuests(doc);
  const seating = readSeating(doc);
  const cast = readCast(doc);
  const label = (groupId: string) => {
    const group = ceremony.processional.find((entry) => entry.id === groupId);
    return group ? resolveMembers(group, guests, seating, cast.roles, cast.customRoles, doc.event).label : "A group";
  };
  const times = startTimes(ceremony.order, startMin);
  const cues = musicCues(ceremony, label);

  return (
    <fieldset className={styles.outputs}>
      <legend className={styles.legend}>From the ceremony</legend>
      <ol aria-label="The order of service" className={styles.cues}>
        {ceremony.order.map((moment, index) => (
          <li key={moment.id}>
            <span className={styles.resolved}>{times[index] === null ? "Before" : formatClock(times[index] ?? startMin)}</span> {moment.title || "A moment"}
          </li>
        ))}
      </ol>
      {cues.length > 0 && (
        <ol aria-label="The music cues" className={styles.cues}>
          {cues.map((cue, index) => (
            <li key={index}>
              ♪ {songName(cue.song)}
              <span className={styles.slack}>
                {" "}
                — {[cue.where, cue.cue && `cue: ${cue.cue}`, songPlaying(cue.song)].filter(Boolean).join(", ")}
              </span>
            </li>
          ))}
        </ol>
      )}
      <Link href="/ceremony" className={styles.slack}>
        Plan it in Ceremony
      </Link>
    </fieldset>
  );
}
