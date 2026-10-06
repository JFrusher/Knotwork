import { useState, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react'

type Field = HTMLInputElement | HTMLTextAreaElement

/**
 * Controlled text input/textarea that commits on blur or Enter and stays in
 * sync with external changes (e.g. undo) while not focused. Avoids spamming
 * the store on every keystroke.
 */
export default function TextField({
  value,
  onCommit,
  as = 'input',
  ...rest
}: {
  value: string | null | undefined
  onCommit: (value: string) => void
  as?: 'input' | 'textarea'
  className?: string
  placeholder?: string
  type?: string
  list?: string
  'aria-label'?: string
}) {
  const [draft, setDraft] = useState(value ?? '')
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(value ?? '')
  }, [value])

  const commit = () => {
    focused.current = false
    if (draft !== (value ?? '')) onCommit(draft)
  }

  const field = {
    value: draft,
    onFocus: () => {
      focused.current = true
    },
    onChange: (e: ChangeEvent<Field>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: KeyboardEvent<Field>) => {
      if (e.key === 'Enter' && as !== 'textarea') e.currentTarget.blur()
      if (e.key === 'Escape') {
        setDraft(value ?? '')
        focused.current = false
        e.currentTarget.blur()
      }
    },
  }
  return as === 'textarea' ? <textarea {...field} {...rest} /> : <input {...field} {...rest} />
}
