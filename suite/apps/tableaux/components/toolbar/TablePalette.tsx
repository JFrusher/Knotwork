import { useDraggable } from '@dnd-kit/core'
import clsx from 'clsx'
import { TABLE_TYPE_LIST, type TableTypeDef } from '../../utils/tableTypes'
import { useStore } from '../../store/useStore'
import Icon from '../ui/Icon'
import IconButton from '../ui/IconButton'
import TableThumbnail from './TableThumbnail'
import { addTableFromPalette, type DragData } from '../../hooks/useCanvasDnd'
import type { TablePreset } from '../../store/types'
import { viewportCentre } from '../../utils/canvasCoords'
import styles from './TablePalette.module.css'

function PaletteItem({ def }: { def: TableTypeDef }) {
  const data: DragData = { type: 'palette', tableType: def.id }
  const { listeners, attributes, setNodeRef, isDragging } = useDraggable({
    id: `palette_${def.id}`,
    data,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={clsx(styles.item, isDragging && styles.dragging)}
      title={`Add a ${def.label.toLowerCase()} table, or drag it where you want it`}
      {...listeners}
      {...attributes}
      // A drag starts only after the pointer moves, so a press is a click:
      // the table goes in the middle of the view, from the keyboard too.
      onClick={() => addTableFromPalette(data, viewportCentre())}
    >
      <span className={styles.thumb}>
        <TableThumbnail type={def.id} size={30} />
      </span>
      <span className={styles.label}>{def.label}</span>
    </button>
  )
}

function PresetItem({ preset, onDelete }: { preset: TablePreset; onDelete: (id: string) => void }) {
  const data: DragData = { type: 'palette-preset', presetId: preset.id }
  const { listeners, attributes, setNodeRef, isDragging } = useDraggable({
    id: `palette_preset_${preset.id}`,
    data,
  })
  return (
    <div className={clsx(styles.item, styles.presetItem, isDragging && styles.dragging)}>
      <button
        ref={setNodeRef}
        type="button"
        className={styles.presetGrab}
        title={`Add "${preset.name}", or drag it where you want it`}
        {...listeners}
        {...attributes}
        onClick={() => addTableFromPalette(data, viewportCentre())}
      >
        <span className={styles.thumb}>
          <TableThumbnail type={preset.type} size={30} />
        </span>
        <span className={styles.label}>{preset.name}</span>
      </button>
      <IconButton
        icon="x"
        label={`Delete preset ${preset.name}`}
        size={18}
        iconSize={11}
        className={styles.presetDelete}
        onClick={() => onDelete(preset.id)}
      />
    </div>
  )
}

export default function TablePalette() {
  const openModal = useStore((s) => s.openModal)
  const presets = useStore((s) => s.settings.customTablePresets || [])
  const deleteTablePreset = useStore((s) => s.deleteTablePreset)
  return (
    <div
      data-tour="seating.toolbar"
      className={styles.palette}
      role="group"
      aria-label="Add a table"
    >
      {TABLE_TYPE_LIST.map((def) => (
        <PaletteItem key={def.id} def={def} />
      ))}
      <button
        type="button"
        className={styles.item}
        title="Build a custom rectangle/square table with seats per side"
        onClick={() => openModal('customTable')}
      >
        <span className={styles.thumb}>
          <Icon name="plus" size={20} />
        </span>
        <span className={styles.label}>Custom</span>
      </button>
      {presets.map((preset) => (
        <PresetItem key={preset.id} preset={preset} onDelete={deleteTablePreset} />
      ))}
    </div>
  )
}
