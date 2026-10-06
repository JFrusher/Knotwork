import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from './ErrorBoundary'
import { download } from '@/lib/data/file'
import { useKnotworkStore } from '@/lib/store/useKnotworkStore'

vi.mock('@/lib/data/file', () => ({ download: vi.fn() }))

// Stands in for a panel reading bad table or guest data: it throws on every
// render, so "Try again" alone can never get past it.
function AlwaysThrows(): never {
  throw new Error('table t1 has no seats')
}

describe('ErrorBoundary', () => {
  it('offers a way out when the child throws on every render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(
      <ErrorBoundary label="The canvas hit a snag">
        <AlwaysThrows />
      </ErrorBoundary>
    )

    expect(screen.getByText('The canvas hit a snag')).toBeInTheDocument()
    expect(screen.getByText('table t1 has no seats')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Download your wedding' }))
    expect(download).toHaveBeenCalledTimes(1)
    expect(vi.mocked(download).mock.calls[0][0]).toMatch(/\.knotwork\.json$/)

    // Retrying re-renders the same data and lands back here, with the way out
    // still on offer.
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()
  })

  it('does not promise work is saved when saving has failed, and says to download first', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useKnotworkStore.setState({ saveError: 'This browser is out of storage space.' })
    render(
      <ErrorBoundary>
        <AlwaysThrows />
      </ErrorBoundary>
    )
    expect(screen.queryByText(/Nothing has been lost/)).toBeNull()
    expect(screen.getByText(/not been saved on this device/)).toHaveTextContent(/Download your wedding before reloading/)
    useKnotworkStore.setState({ saveError: null })
  })
})
