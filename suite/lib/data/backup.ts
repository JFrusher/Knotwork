import { migrate, serialise, suggestedFilename } from "@jfrusher/knotwork";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { download } from "./file";

/** The whole wedding, as the `.knotwork.json` it would be restored from. */
export function downloadBackup(): void {
  const doc = migrate(useKnotworkStore.getState().raw);
  download(suggestedFilename(doc), serialise(doc));
}
