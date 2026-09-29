import { useEffect } from 'react'
import { useTrousseauStore } from '@/lib/store/useTrousseauStore'
import { useStore } from '../store/useStore.js'
import { fitCanvasToContent, zoomCanvasBy } from '../utils/canvasCoords.js'

const isEditable = (el) =>
  !!el &&
  (el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable)

/** Global keyboard shortcuts (see the README table). Mounted once at the root. */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e) => {
      const s = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key

      // Every change is in the wedding as it is made, so there is nothing to
      // save — but the habit is strong, and the browser's own Save Page is
      // never what was meant.
      if (mod && key.toLowerCase() === 's') {
        e.preventDefault()
        return
      }

      // An open modal owns the keyboard. Everything below this point acts on
      // the canvas *behind* the modal, which the user can't see — and
      // isEditable() wouldn't catch it, since most modal controls are plain
      // <button>s (segmented toggles, steppers). Escape still closes.
      if (s.modal) {
        if (key === 'Escape') s.closeModal()
        return
      }

      // Don't hijack keys while typing in a field.
      if (isEditable(document.activeElement)) return

      // The wedding's one history: what the header's buttons drive.
      const history = useTrousseauStore.getState()
      if (mod && key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) history.redo()
        else history.undo()
        return
      }
      if (mod && key.toLowerCase() === 'y') {
        e.preventDefault()
        history.redo()
        return
      }
      if (mod && key.toLowerCase() === 'a') {
        e.preventDefault()
        s.setSelectedGuestIds(
          Object.values(s.guests)
            .filter((g) => !g.assignedTableId)
            .map((g) => g.id)
        )
        return
      }
      if (mod && key.toLowerCase() === 'd') {
        if (s.selection.type === 'table' && s.tables[s.selection.id]) {
          e.preventDefault()
          s.duplicateTable(s.selection.id)
        }
        return
      }
      if (mod) return // leave other browser shortcuts alone

      switch (key) {
        case 'Escape':
          if (s.activeTool !== 'select') s.setActiveTool('select')
          else s.clearSelection()
          break
        case 'Delete':
        case 'Backspace':
          if (s.selection.type === 'table' && s.tables[s.selection.id]) {
            e.preventDefault()
            const t = s.tables[s.selection.id]
            s.openModal('confirm', {
              title: 'Delete table?',
              message: `"${t.label}" will be removed and its guests returned to the waiting list.`,
              confirmLabel: 'Delete',
              danger: true,
              onConfirm: () => {
                s.removeTable(t.id)
                s.clearSelection()
              },
            })
          }
          break
        case 'f':
        case 'F':
          fitCanvasToContent()
          break
        case '+':
        case '=':
          zoomCanvasBy(1.2)
          break
        case '-':
        case '_':
          zoomCanvasBy(1 / 1.2)
          break
        case 'g':
        case 'G':
          if (s.selectedGuestIds.length > 0) {
            s.createGroup(s.selectedGuestIds)
            s.clearSelection()
          }
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
