"use client";

import { useEffect, useMemo, useRef } from "react";
import { GALLERY, type GalleryTemplate } from "../core/data/gallery";
import { SheetPreview } from "../render/svg/SheetPreview";
import { galleryPreview } from "../state/galleryPreview";
import { useStationery } from "../state/store";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import styles from "./DesignsGallery.module.css";

/** The gallery's two shelves: what is printed for guests' seats, and the booklet. */
const SHELVES = [
  { title: "The order of service", booklet: true },
  { title: "Cards, signs and boards", booklet: false },
] as const;

/**
 * Every design to start from, each drawn with this wedding's own names. A
 * design opens as a piece of its own — the order of service beside the place
 * cards — or restyles the piece on screen when it is the same kind of thing.
 */
export function DesignsGallery({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const doc = useKnotworkStore((s) => s.doc);
  const fonts = useStationery((s) => s.fonts);
  const room = useStationery((s) => s.room);
  const booklet = useStationery((s) => s.booklet !== null);
  const pieceName = useStationery((s) => s.pieces.find((p) => p.id === s.pieceId)?.name ?? "this piece");
  const { openPiece, applyGalleryTemplate } = useStationery.getState();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const previews = useMemo(
    () => new Map(GALLERY.map((entry) => [entry.id, galleryPreview(entry, doc, fonts, room)])),
    [doc, fonts, room],
  );

  const choose = (act: () => void) => {
    act();
    onClose();
  };

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="designs-title" onClose={onClose}>
      <div className={styles.head}>
        <h2 id="designs-title" className={styles.title}>
          Designs
        </h2>
        <button type="button" className={styles.close} onClick={onClose}>
          Close
        </button>
      </div>
      <p className={styles.intro}>
        Start from one of these and make it yours: every font, colour, picture and position can be changed afterwards. Each
        is shown with your own names.
      </p>
      {SHELVES.map((shelf) => (
        <section key={shelf.title} aria-label={shelf.title}>
          <h3 className={styles.group}>{shelf.title}</h3>
          <ul className={styles.grid}>
            {GALLERY.filter((entry) => Boolean(entry.booklet) === shelf.booklet).map((entry: GalleryTemplate) => (
              <li key={entry.id} className={styles.item}>
                <div className={styles.preview} aria-hidden>
                  <SheetPreview sheet={previews.get(entry.id)!} fonts={fonts} />
                </div>
                <p className={styles.name}>{entry.name}</p>
                <p className={styles.description}>{entry.description}</p>
                <div className={styles.buttons}>
                  <button type="button" onClick={() => choose(() => openPiece(entry.id))} aria-label={`Open ${entry.name}`}>
                    Open
                  </button>
                  {Boolean(entry.booklet) === booklet && (
                    <button type="button" onClick={() => choose(() => applyGalleryTemplate(entry))} aria-label={`Restyle ${pieceName} as ${entry.name}`}>
                      Restyle {pieceName}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </dialog>
  );
}
