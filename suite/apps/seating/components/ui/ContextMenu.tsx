import { useState, useEffect, useLayoutEffect, useRef, useCallback, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import Icon, { type IconName } from './Icon'
import styles from './ContextMenu.module.css'

/** Hook that tracks a right-click menu's open position. */
/** One entry in a context menu, or a line between entries. */
export type MenuItem =
  | { label: string; icon?: IconName; onClick?: () => void; danger?: boolean; disabled?: boolean; hint?: string; separator?: undefined }
  | { separator: true; label?: undefined }

export function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const openAt = useCallback((e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY })
  }, [])
  const close = useCallback(() => setMenu(null), [])
  return { menu, openAt, close }
}

/**
 * Portalled context menu. `items` is a list of
 * { label, icon?, onClick, danger?, disabled?, hint? } or { separator: true }.
 */
export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: Array<MenuItem | null | false | undefined>
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  // Keep the menu within the viewport.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.right > window.innerWidth) el.style.left = `${Math.max(8, x - r.width)}px`
    if (r.bottom > window.innerHeight) el.style.top = `${Math.max(8, y - r.height)}px`
  }, [x, y])

  return createPortal(
    <div ref={ref} className={clsx('seating-tokens', styles.menu)} style={{ left: x, top: y }} role="menu">
      {items.filter((it): it is MenuItem => Boolean(it)).map((it, i) =>
        it.separator ? (
          <div key={`sep-${i}`} className={styles.separator} />
        ) : (
          <button
            key={it.label}
            type="button"
            role="menuitem"
            className={clsx(styles.item, it.danger && styles.danger)}
            disabled={it.disabled}
            onClick={() => {
              it.onClick?.()
              onClose()
            }}
          >
            {it.icon && <Icon name={it.icon} size={15} className={styles.itemIcon} />}
            <span className={styles.itemLabel}>{it.label}</span>
            {it.hint && <span className={styles.hint}>{it.hint}</span>}
          </button>
        )
      )}
    </div>,
    document.body
  )
}
