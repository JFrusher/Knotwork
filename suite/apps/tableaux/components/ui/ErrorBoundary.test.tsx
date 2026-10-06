import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from './ErrorBoundary'

const { downloadBackup } = vi.hoisted(() => ({ downloadBackup: vi.fn() }))
vi.mock('@/lib/data/backup', () => ({ downloadBackup }))

// The bad-data case: whatever the boundary does, this child throws again.
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
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Download your wedding' }))
    expect(downloadBackup).toHaveBeenCalledTimes(1)
  })
})
