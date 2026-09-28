import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { readDoc, writeDoc } from '../store/sliceBridge'

/**
 * Loads the plan on mount and writes it back as it changes.
 *
 * This file used to be the largest piece of Tableaux's back end: a plan id, a
 * server revision, optimistic concurrency, a 409 handler that asked the user
 * which version should win, a localStorage crash backup, a `sendBeacon` on
 * unload and a retry when connectivity returned.
 *
 * None of it is gone — all of it moved. The shell stores the wedding on this
 * device, so there is no request to fail and nothing to back up against its
 * failure; it syncs to the account, so the version that wins is settled by the
 * conflict resolution shared with the other tools rather than by one tool's
 * own dialogue; and it writes to IndexedDB the moment it is handed the plan,
 * which is what the beacon was for.
 *
 * What is left is the part that was always Tableaux's: read the document, and
 * write it back when it changes.
 */

/**
 * Kept because the toolbar and ⌘S call it, and because a manual save should
 * still say "saved". The write itself is immediate — there is no network — so
 * this is mostly about the status the user sees.
 */
export async function saveNow({ manual = false } = {}) {
  const s = useStore.getState()
  if (!s.loaded) return
  if (!manual && !s.isDirty()) return

  const revAtSave = s._rev
  s.setSaveStatus('saving')
  try {
    writeDoc(s.serialize())
    useStore.setState({
      save: { status: 'saved', lastSavedAt: new Date().toISOString(), lastSavedRev: revAtSave },
    })
  } catch {
    // A local write fails only if the browser is refusing storage outright. The
    // shell says so itself, in one place, rather than each tool having its own
    // version of that conversation.
    useStore.setState((st) => ({ save: { ...st.save, status: 'error' } }))
  }
}

/**
 * How long the plan waits after the last edit before handing it to the shared
 * store — the same as the other tools. A drag bumps `_rev` every frame, so this
 * writes once when the drag ends rather than sixty times a second.
 */
const SAVE_DELAY_MS = 400

export function useAutoSave() {
  useEffect(() => {
    useStore.getState().hydrate(readDoc())

    // On every document change rather than on a clock. This was a 30-second
    // interval, and anything done inside that half-minute was gone on reload:
    // on screen, never saved.
    let timer = null
    const flush = () => {
      clearTimeout(timer)
      timer = null
      saveNow({ manual: false })
    }
    const unsubscribe = useStore.subscribe((state, previous) => {
      if (state._rev === previous._rev) return
      clearTimeout(timer)
      timer = setTimeout(flush, SAVE_DELAY_MS)
    })

    // The shared store writes to IndexedDB the moment it is handed the plan,
    // so the page going away only has to hand over the edit still inside the
    // delay above.
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onHide)

    return () => {
      unsubscribe()
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onHide)
      // Switching to another tool unmounts this one without the browser ever
      // firing an unload, so the pending edit is handed over here too.
      flush()
    }
  }, [])
}
