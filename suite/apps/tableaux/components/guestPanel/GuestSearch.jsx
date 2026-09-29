import clsx from 'clsx'
import { useStore } from '../../store/useStore'
import Icon from '../ui/Icon'
import { filterDefs } from '../../utils/guestFilters'
import styles from './GuestSearch.module.css'

export default function GuestSearch() {
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const filters = useStore((s) => s.filters)
  const toggleFilter = useStore((s) => s.toggleFilter)
  const clearFilters = useStore((s) => s.clearFilters)
  const meta = useStore((s) => s.meta)

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <Icon name="search" size={15} className={styles.icon} />
        <input
          className={styles.input}
          type="text"
          placeholder="Search guests & groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search guests"
        />
        {search && (
          <button
            type="button"
            className={styles.clear}
            onClick={() => setSearch('')}
            aria-label="Clear search"
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      <div className={styles.chips} role="group" aria-label="Filters">
        <button
          type="button"
          className={clsx(styles.chip, filters.length === 0 && styles.active)}
          onClick={clearFilters}
        >
          All
        </button>
        {filterDefs(meta).map((f) => (
          <button
            key={f.key}
            type="button"
            className={clsx(styles.chip, filters.includes(f.key) && styles.active)}
            aria-pressed={filters.includes(f.key)}
            onClick={() => toggleFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}
