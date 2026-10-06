import { useState, useEffect, useId, useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import f from './fields.module.css'

type Field = HTMLInputElement | HTMLTextAreaElement

/**
 * Controlled text input/textarea that commits on blur or Enter and stays in
 * sync with external changes (e.g. undo) while not focused. Avoids spamming
 * the store on every keystroke.
 *
 * `invalid` names what is wrong with a draft, or returns null. An invalid draft
 * is kept in the field, marked, and explained in a message the field is tied
 * to, and nothing is committed; Escape is the way back to the stored value.
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
  invalid?: (value: string) => string | null
  as?: 'input' | 'textarea'
  className?: string
  placeholder?: string
  type?: string
  list?: string
  'aria-label'?: string
}) {
  const [draft, setDraft] = useState(value ?? '')
  const [problem, setProblem] = useState<string | null>(null)
  const focused = useRef(false)
  const messageId = useId()

  useEffect(() => {
    if (!focused.current) {
      setDraft(value ?? '')
      setProblem(null)
    }
  }, [value])

  const commit = () => {
    // Escape has already ended the edit; its blur must not commit the draft.
    if (!focused.current) return
    focused.current = false
    if (draft === (value ?? '')) return setProblem(null)
    const wrong = invalid ? invalid(draft) : null
    setProblem(wrong)
    if (!wrong) onCommit(draft)
  }

  const field = {
    value: draft,
    className: clsx(className, problem && f.invalid),
    'aria-invalid': problem ? true : undefined,
    'aria-describedby': problem ? messageId : undefined,
    onFocus: () => {
      focused.current = true
    },
    onChange: (e: ChangeEvent<Field>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: KeyboardEvent<Field>) => {
      if (e.key === 'Enter' && as !== 'textarea') e.currentTarget.blur()
      if (e.key === 'Escape') {
        setDraft(value ?? '')
        setProblem(null)
        focused.current = false
        e.currentTarget.blur()
      }
    },
  }
  return (
    <>
      {as === 'textarea' ? <textarea {...rest} {...field} /> : <input {...rest} {...field} />}
      {problem && (
        <span id={messageId} className={f.problem}>
          {problem}
        </span>
      )}
    </>
  )
}
