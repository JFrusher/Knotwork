'use client'

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  getClientRect,
} from '@dnd-kit/core'
import { useAutoSave } from './hooks/useAutoSave.js'
import { useCanvasDnd } from './hooks/useCanvasDnd.js'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import { WarningsProvider } from './store/warningsContext.jsx'
import AppShell from './components/layout/AppShell.jsx'
import ModalRoot from './components/layout/ModalRoot.jsx'
import ToastViewport from './components/ui/Toast.jsx'
import DragPreview from './components/canvas/DragPreview.jsx'
import { useStore } from './store/useStore.js'
import { useSelectFromAddress } from '@/components/shell/useSelectFromAddress'

/** A link to one table — the command palette's — opens on it. */
const selectTable = (id) => useStore.getState().select('table', id)

export default function App() {
  useAutoSave()
  useKeyboardShortcuts()
  useSelectFromAddress(selectTable)

  // Touch uses a press-and-hold to start a drag so a quick swipe still scrolls
  // the guest list / pans the canvas. Mouse keeps the small distance threshold.
  //
  // No keyboard sensor. Every drop here is found with `pointerWithin`, which
  // returns nothing when there is no pointer, so a keyboard drag could never
  // land — and the sensor took Enter and Space from every draggable button.
  // Each drag has a direct equivalent instead: pressing a table in the palette
  // adds it, pressing a guest opens them, and the guest's panel seats them.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const { activeDrag, onDragStart, onDragEnd, onDragCancel } = useCanvasDnd()

  // When the pointer is inside multiple nested containers at once (a family
  // inside a subgroup inside a group), pointerWithin returns all of them. Sort
  // so the innermost always wins — otherwise an outer container intercepts the
  // drop and e.g. addToGroup fires instead of addToFamily.
  const nestingPriority = { family: 0, subgroup: 1, group: 2 }
  const innermostFirstCollision = (args) => {
    const hits = pointerWithin(args)
    return [...hits].sort((a, b) => {
      const ta = a.data?.droppableContainer?.data?.current?.type
      const tb = b.data?.droppableContainer?.data?.current?.type
      const pa = nestingPriority[ta] ?? 99
      const pb = nestingPriority[tb] ?? 99
      return pa - pb
    })
  }

  return (
    <DndContext
      sensors={sensors}
      // Measure drop targets as they are drawn. The default ignores each
      // element's own transform, and every table is centred on its position
      // with `translate(-50%, -50%)`: the hit area sat half a table down and
      // to the right, so a guest dropped on a table's top-left half missed,
      // and one dropped on the floor beside it was seated.
      measuring={{ droppable: { measure: getClientRect } }}
      // Read out for every draggable. The library's default tells people to
      // press Space and use the arrow keys, which is exactly what does not work
      // here — see the sensors above.
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Drag with a mouse or finger to move it. From the keyboard, press Enter on a table or a guest and use its panel.',
        },
      }}
      collisionDetection={innermostFirstCollision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <WarningsProvider>
        <AppShell />
        <DragOverlay dropAnimation={null} zIndex={9999}>
          <DragPreview drag={activeDrag} />
        </DragOverlay>
        <ModalRoot />
        <ToastViewport />
      </WarningsProvider>
    </DndContext>
  )
}
