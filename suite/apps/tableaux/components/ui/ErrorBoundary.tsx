import { Component, type ErrorInfo, type ReactNode } from 'react'
import { downloadBackup } from '@/lib/data/backup'
import styles from './ErrorBoundary.module.css'

/**
 * Error boundaries are the one place React still requires a class component
 * (there is no hook equivalent). Wraps a panel so a render error in one region
 * doesn't take down the whole app.
 *
 * "Try again" re-renders the same data, so when the data is the cause it
 * throws again at once. Reload and a download of the wedding are offered
 * beside it, as `app/error.tsx` does, so a crash is never a dead end.
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
          <p className={styles.detail}>Your wedding is still saved on this device.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.retry} onClick={this.reset}>
              Try again
            </button>
            <button type="button" className={styles.retry} onClick={() => window.location.reload()}>
              Reload the page
            </button>
            <button type="button" className={styles.retry} onClick={downloadBackup}>
              Download your wedding
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
