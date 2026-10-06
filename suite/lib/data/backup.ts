import { migrate, serialise, suggestedFilename } from "@jfrusher/knotwork";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { download } from "./file";

/**
 * Writes the whole wedding open on this device to the downloads folder, as the
 * `.knotwork.json` a restore reads back. Throws when it cannot be written.
 */
export function downloadWedding(): void {
  const doc = migrate(useKnotworkStore.getState().raw);
  download(suggestedFilename(doc), serialise(doc));
}
