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
  type CollisionDetection,
} from '@dnd-kit/core'
import { useCanvasDnd } from './hooks/useCanvasDnd'
import { dragAnnouncements } from './hooks/dragAnnouncements'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { WarningsProvider } from './store/warningsContext'
import AppShell from './components/layout/AppShell'
import ModalRoot from './components/layout/ModalRoot'
import ToastViewport from './components/ui/Toast'
import DragPreview from './components/canvas/DragPreview'
import { useStore } from './store/useStore'
import { useSelectFromAddress } from '@/components/shell/useSelectFromAddress'

/** A link to one table — the command palette's — opens on it. */
const selectTable = (id: string) => useStore.getState().select('table', id)

export default function App() {
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
  const announcements = dragAnnouncements(useStore.getState)

  // When the pointer is inside multiple nested containers at once (a family
  // inside a subgroup inside a group), pointerWithin returns all of them. Sort
  // so the innermost always wins — otherwise an outer container intercepts the
  // drop and e.g. addToGroup fires instead of addToFamily.
  const nestingPriority: Record<string, number> = { family: 0, subgroup: 1, group: 2 }
  const innermostFirstCollision: CollisionDetection = (args) => {
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
      // here — see the sensors above. Its default announcements speak ids.
      accessibility={{
        announcements,
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
