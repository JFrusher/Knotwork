import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useStore } from './useStore'
import { computeWarnings, buildWarningIndex, type SeatingWarning } from '../utils/warnings'

const EMPTY: SeatingWarning[] = []

interface Warnings {
  list: SeatingWarning[]
  byTable: Map<string, SeatingWarning[]>
  byGuest: Map<string, SeatingWarning[]>
}

const WarningsContext = createContext<Warnings>({ list: EMPTY, byTable: new Map(), byGuest: new Map() })

export function WarningsProvider({ children }: { children: ReactNode }) {
  const guests = useStore((s) => s.guests)
  const tables = useStore((s) => s.tables)
  const constraints = useStore((s) => s.constraints)
  const families = useStore((s) => s.families)

  const value = useMemo(() => {
    const list = computeWarnings({ guests, tables, constraints, families })
    return { list, ...buildWarningIndex(list) }
  }, [guests, tables, constraints, families])

  return <WarningsContext.Provider value={value}>{children}</WarningsContext.Provider>
}

export const useWarnings = () => useContext(WarningsContext)
export const useTableWarnings = (id: string): SeatingWarning[] => useContext(WarningsContext).byTable.get(id) || EMPTY
export const useGuestWarnings = (id: string): SeatingWarning[] => useContext(WarningsContext).byGuest.get(id) || EMPTY
