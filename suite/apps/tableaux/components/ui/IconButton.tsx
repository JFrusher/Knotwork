import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
import Icon, { type IconName } from './Icon'
import styles from './IconButton.module.css'

/**
 * A 32×32 ghost-style icon button. `label` is required and used for the
 * accessible name (and a native tooltip). Pass an icon name string or a
 * custom node via `icon`.
 */
type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: IconName | ReactNode
  label: string
  size?: number
  iconSize?: number
  active?: boolean
  variant?: 'ghost' | 'solid'
  onDark?: boolean
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    label,
    size = 32,
    iconSize = 18,
    active = false,
    variant = 'ghost',
    onDark = false,
    className,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      className={clsx(
        styles.iconButton,
        styles[variant],
        active && styles.active,
        onDark && styles.onDark,
        className
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      {typeof icon === 'string' ? <Icon name={icon as IconName} size={iconSize} /> : icon}
    </button>
  )
})

export default IconButton
