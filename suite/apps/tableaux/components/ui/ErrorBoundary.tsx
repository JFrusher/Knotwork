import { Component, type ErrorInfo, type ReactNode } from 'react'
import { downloadWedding } from '@/lib/data/backup'
import { useKnotworkStore } from '@/lib/store/useKnotworkStore'
import styles from './ErrorBoundary.module.css'

/**
 * Error boundaries are the one place React still requires a class component
 * (there is no hook equivalent). Wraps a panel so a render error in one region
 * doesn't take down the whole app.
 *
 * "Try again" only clears this boundary's state, so when the cause is the
 * wedding's data rather than the render, the panel throws again at once. Reload
 * and a download of the wedding are offered beside it, as in `app/error.tsx`,
 * so a crash never reads as lost work.
 */
export default class ErrorBoundary extends Component<{ label?: string; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Tableaux] panel error:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className={styles.fallback}>
          <p className={styles.title}>{this.props.label || 'Something went wrong'}</p>
          <p className={styles.detail}>{this.state.error.message}</p>
          <p className={styles.detail}>
            {/* After a failed save, what is on screen is only in this tab:
                the download keeps it, a reload would not. */}
            {useKnotworkStore.getState().saveError
              ? 'Your latest changes have not been saved on this device. Download your wedding before reloading.'
              : 'Your wedding is still saved on this device. Nothing has been lost.'}
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.retry} onClick={downloadWedding}>
              Download your wedding
            </button>
            <button type="button" className={styles.retry} onClick={() => window.location.reload()}>
              Reload the page
            </button>
            <button type="button" className={styles.retry} onClick={this.reset}>
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
