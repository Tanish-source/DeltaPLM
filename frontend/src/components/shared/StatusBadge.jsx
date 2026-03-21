import { ECO_STATUS_LABELS, ECO_STATUS_STYLES } from '@/lib/constants'

/**
 * Colored badge for ECO statuses.
 * @param {{ status: string, className?: string }} props
 */
export default function StatusBadge({ status, className = '' }) {
  const label = ECO_STATUS_LABELS[status] || status
  const style = ECO_STATUS_STYLES[status] || 'bg-secondary text-secondary-foreground'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}
    >
      {label}
    </span>
  )
}
