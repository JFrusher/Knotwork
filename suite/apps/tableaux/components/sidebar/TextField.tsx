import { useState, useEffect, useId, useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import f from './fields.module.css'

type Field = HTMLInputElement | HTMLTextAreaElement

/**
 * Controlled text input/textarea that commits on blur or Enter and stays in
 * sync with external changes (e.g. undo) while not focused. Avoids spamming
 * the store on every keystroke.
 *
 * `invalid` returns a message for a value that can't be saved. What was typed
 * is then kept, marked and tied to the message, and nothing is committed, as
 * the app's own `TimeField` holds and marks bad text. Escape goes back to the
 * saved value without committing.
 */
export default function TextField({
  value,
  onCommit,
  invalid,
  as = 'input',
  className,
  ...rest
}: {
  value: string | null | undefined
  onCommit: (value: string) => void
  invalid?: (value: string) => string | undefined
  as?: 'input' | 'textarea'
  className?: string
  placeholder?: string
  type?: string
  list?: string
  'aria-label'?: string
}) {
  const [draft, setDraft] = useState(value ?? '')
  const [error, setError] = useState('')
  const focused = useRef(false)
  // Escape blurs the field, and the blur must not commit what it threw away.
  const cancelled = useRef(false)
  const errorId = useId()

  useEffect(() => {
    if (!focused.current) {
      setDraft(value ?? '')
      setError('')
    }
  }, [value])

  const commit = () => {
    focused.current = false
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    const problem = invalid?.(draft)
    setError(problem ?? '')
    if (!problem && draft !== (value ?? '')) onCommit(draft)
  }

  const field = {
    value: draft,
    className: clsx(className, error && f.invalid),
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
    onFocus: () => {
      focused.current = true
    },
    onChange: (e: ChangeEvent<Field>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: KeyboardEvent<Field>) => {
      if (e.key === 'Enter' && as !== 'textarea') e.currentTarget.blur()
      if (e.key === 'Escape') {
        setDraft(value ?? '')
        setError('')
        cancelled.current = true
        e.currentTarget.blur()
      }
    },
  }
  return (
    <span className={f.fieldWithError}>
      {as === 'textarea' ? <textarea {...field} {...rest} /> : <input {...field} {...rest} />}
      {error && (
        <span id={errorId} className={f.errorText}>
          {error}
        </span>
      )}
    </span>
  )
}
