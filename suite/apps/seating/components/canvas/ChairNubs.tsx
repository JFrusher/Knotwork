import type { Seat } from '../../utils/seatPositions'
import styles from './ChairNubs.module.css'

/**
 * Non-interactive chair "nubs" drawn around a table so its true footprint —
 * the space the seated guests actually occupy — is visible at a glance. One
 * lightweight SVG of circles per table (not a div per chair) keeps this cheap
 * even with hundreds of tables. Interactive per-seat assignment still uses
 * SeatSlot, layered on top in seat mode.
 */
export default function ChairNubs({
  seats,
  chairPx,
  width,
  height,
}: {
  seats: Seat[]
  chairPx: number
  width: number
  height: number
}) {
  if (!seats?.length) return null
  const r = Math.max(3, chairPx / 2)
  return (
    <svg
      className={styles.chairs}
      width={width}
      height={height}
      viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
      aria-hidden="true"
    >
      {seats.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={r} />
      ))}
    </svg>
  )
}
