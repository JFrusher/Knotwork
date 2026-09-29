import { useState, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import clsx from 'clsx'
import { useStore } from '../../store/useStore'
import ContextMenu, { useContextMenu, type MenuItem } from '../ui/ContextMenu'
import styles from './ZoneLabel.module.css'

export default function ZoneLabel({
  zoneId,
  screenToCanvas,
}: {
  zoneId: string
  screenToCanvas: (clientX: number, clientY: number) => { x: number; y: number }
}) {
  const zone = useStore((s) => s.zones[zoneId])
  const isSelected = useStore((s) => s.selection.type === 'zone' && s.selection.id === zoneId)
  const gridSnap = useStore((s) => s.settings.gridSnap)
  const gridSize = useStore((s) => s.settings.gridSize || 20)
  const select = useStore((s) => s.select)
  const moveZone = useStore((s) => s.moveZone)
  const resizeZone = useStore((s) => s.resizeZone)
  const reshapeZone = useStore((s) => s.reshapeZone)
  const patchEntityLive = useStore((s) => s.patchEntityLive)
  const renameZone = useStore((s) => s.renameZone)
  const removeZone = useStore((s) => s.removeZone)

  const { menu, openAt, close } = useContextMenu()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const movedRef = useRef(false)

  if (!zone) return null

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || editing) return
    e.stopPropagation()
    const start = screenToCanvas(e.clientX, e.clientY)
    const orig = useStore.getState().zones[zoneId]
    movedRef.current = false
    const onMove = (ev: PointerEvent) => {
      const p = screenToCanvas(ev.clientX, ev.clientY)
      if (!movedRef.current && Math.abs(p.x - start.x) + Math.abs(p.y - start.y) > 2) {
        movedRef.current = true
      }
      let nx = orig.x + (p.x - start.x)
      let ny = orig.y + (p.y - start.y)
      if (gridSnap) {
        nx = Math.round(nx / gridSize) * gridSize
        ny = Math.round(ny / gridSize) * gridSize
      }
      patchEntityLive('zones', zoneId, { x: Math.round(nx), y: Math.round(ny) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (movedRef.current) {
        const fz = useStore.getState().zones[zoneId]
        moveZone(zoneId, fz.x, fz.y)
      } else {
        select('zone', zoneId)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startResize = (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const orig = useStore.getState().zones[zoneId]
    const onMove = (ev: PointerEvent) => {
      const p = screenToCanvas(ev.clientX, ev.clientY)
      patchEntityLive('zones', zoneId, {
        width: Math.max(40, Math.round(p.x - orig.x)),
        height: Math.max(40, Math.round(p.y - orig.y)),
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const fz = useStore.getState().zones[zoneId]
      if (fz !== orig) resizeZone(zoneId, { width: fz.width, height: fz.height })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startRename = () => {
    setDraft(zone.label)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }
  const commitRename = () => {
    const v = draft.trim()
    if (v) renameZone(zoneId, v)
    setEditing(false)
  }

  const menuItems: MenuItem[] = [
    { label: 'Rename', icon: 'edit', onClick: startRename },
    {
      label: zone.shape === 'circle' ? 'Make rectangle' : 'Make circle',
      icon: 'square',
      onClick: () => reshapeZone(zoneId),
    },
    { separator: true },
    { label: 'Delete zone', icon: 'trash', danger: true, onClick: () => removeZone(zoneId) },
  ]

  return (
    <div
      className={clsx(styles.zone, isSelected && styles.selected)}
      style={{ left: zone.x, top: zone.y, width: zone.width, height: zone.height }}
      data-canvas-item
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation()
        startRename()
      }}
      onContextMenu={openAt}
    >
      <div
        className={styles.fill}
        style={{
          background: zone.colour,
          borderRadius: zone.shape === 'circle' ? '50%' : 'var(--radius-md)',
        }}
      />
      {editing ? (
        <input
          ref={inputRef}
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <span className={styles.label}>{zone.label}</span>
      )}
      <button
        type="button"
        className={styles.handle}
        aria-label="Resize zone"
        onPointerDown={startResize}
      />
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={close} />}
    </div>
  )
}
