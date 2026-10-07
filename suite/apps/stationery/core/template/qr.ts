import qrcode from "qrcode-generator";

/** The clear border a reader needs round a code, in modules. */
export const QUIET_MODULES = 4;

/**
 * A QR code as one filled path, in module units, with its quiet zone in the
 * view: vector, so it prints sharp at any size and is drawn by the icon
 * pipeline both renderers already have.
 *
 * Text goes in as UTF-8 bytes. The library's own conversion keeps only the
 * low byte of each character, which turns anything past Latin-1 into a
 * different string that still scans.
 */
export function qrPath(text: string): { pathD: string; view: { x: number; y: number; w: number; h: number } } {
  const code = qrcode(0, "M");
  code.addData(String.fromCharCode(...new TextEncoder().encode(text)), "Byte");
  code.make();
  const size = code.getModuleCount();

  // One rectangle per run of dark modules along a row: a fraction of the
  // path a square per module would make.
  const parts: string[] = [];
  for (let row = 0; row < size; row++) {
    let col = 0;
    while (col < size) {
      if (!code.isDark(row, col)) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < size && code.isDark(row, col)) col += 1;
      parts.push(`M${start} ${row}h${col - start}v1h${start - col}z`);
    }
  }
  return {
    pathD: parts.join(""),
    view: { x: -QUIET_MODULES, y: -QUIET_MODULES, w: size + QUIET_MODULES * 2, h: size + QUIET_MODULES * 2 },
  };
}
