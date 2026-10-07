import { useState } from "react";
import { useConfirm } from "@/components/ui/Confirm";
import { useStationery } from "../state/store";
import { DesignsGallery } from "./DesignsGallery";
import styles from "./PiecesBar.module.css";

/**
 * The wedding's stationery, one tab per piece: place cards, table numbers, the
 * seating board. Each is a design of its own; fonts and artwork are shared.
 */
export function PiecesBar() {
  const pieces = useStationery((s) => s.pieces);
  const pieceId = useStationery((s) => s.pieceId);
  const { switchPiece, addPiece, duplicatePiece, renamePiece, removePiece } = useStationery.getState();
  const confirm = useConfirm();
  // Which piece's name is being typed, if any.
  const [renaming, setRenaming] = useState<string | null>(null);
  const [gallery, setGallery] = useState(false);

  const active = pieces.find((p) => p.id === pieceId)!;

  const add = () => {
    addPiece("New piece");
    setRenaming(useStationery.getState().pieceId);
  };

  const remove = async () => {
    const yes = await confirm({
      title: `Remove ${active.name}?`,
      body: "Its design goes, and so does any list it was printing from. Undo brings it back.",
      action: "Remove",
      tone: "danger",
    });
    if (yes) removePiece(active.id);
  };

  return (
    <nav className={styles.bar} aria-label="Pieces">
      <div className={styles.tabs}>
        {pieces.map((piece) =>
          renaming === piece.id ? (
            <input
              key={piece.id}
              className={styles.rename}
              aria-label="Name of this piece"
              defaultValue={piece.name}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => {
                const name = e.currentTarget.value.trim();
                if (name && name !== piece.name) renamePiece(piece.id, name);
                setRenaming(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setRenaming(null);
              }}
            />
          ) : (
            <button
              key={piece.id}
              type="button"
              aria-current={piece.id === pieceId ? "true" : undefined}
              className={piece.id === pieceId ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => switchPiece(piece.id)}
              onDoubleClick={() => setRenaming(piece.id)}
              title="Double-click to rename"
            >
              {piece.name}
            </button>
          ),
        )}
        <button type="button" className={styles.add} onClick={add}>
          + New piece
        </button>
      </div>

      <button type="button" data-tour="stationery.designs" className={styles.designs} onClick={() => setGallery(true)}>
        Designs
      </button>
      {gallery && <DesignsGallery onClose={() => setGallery(false)} />}

      <div className={styles.actions}>
        <button type="button" onClick={() => setRenaming(active.id)}>
          Rename
        </button>
        <button type="button" onClick={() => duplicatePiece(active.id)}>
          Duplicate
        </button>
        <button type="button" onClick={() => void remove()} disabled={pieces.length <= 1}>
          Remove
        </button>
      </div>
    </nav>
  );
}
