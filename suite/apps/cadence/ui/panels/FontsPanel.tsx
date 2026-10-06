import { useRef } from "react";
import { BUNDLED_FONTS } from "@/lib/pdf/fonts";
import { addFont } from "../../state/fontLoader";
import { useStore, useTimelineDoc } from "../../state/store";
import { Button, Panel } from "@/components/ui/fields";
import styles from "./FontsPanel.module.css";

export function FontsPanel() {
  const doc = useTimelineDoc();
  const addToDay = useStore((state) => state.addFont);
  const removeFromDay = useStore((state) => state.removeFont);
  const setNotice = useStore((state) => state.setNotice);
  const input = useRef<HTMLInputElement>(null);

  const onChosen = async (file: File | undefined) => {
    if (!file) return;
    const result = await addFont(file);
    if (result.error !== undefined) {
      setNotice(result.error);
      return;
    }
    if (doc.fonts.some((font) => font.blobKey === result.font.blobKey)) {
      setNotice(`${result.font.family} is already here.`);
      return;
    }
    // The day as it is once the file has been read, not as it was before.
    addToDay(result.font);
    setNotice(`${result.font.family} added.`);
  };

  return (
    <Panel title="Fonts">
      <ul className={styles.list}>
        {BUNDLED_FONTS.map((font) => (
          <li key={font.family} className={styles.item}>
            {font.family}
            <span className={styles.source}>bundled</span>
          </li>
        ))}
        {doc.fonts.map((font) => (
          <li key={font.blobKey} className={styles.item}>
            {font.family}
            <button
              type="button"
              className={styles.remove}
              onClick={() => removeFromDay(font.blobKey)}
            >
              remove
            </button>
          </li>
        ))}
      </ul>

      <Button onClick={() => input.current?.click()}>Add a font file</Button>
      <p className={styles.note}>
        Your fonts stay on this machine. They are embedded into the PDFs you make and sent nowhere.
      </p>
      <input
        ref={input}
        type="file"
        accept=".ttf,.otf,.woff2,font/ttf,font/otf,font/woff2"
        className={styles.file}
        onChange={(event) => {
          void onChosen(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </Panel>
  );
}
