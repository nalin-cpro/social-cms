interface Props { status: string; small?: boolean }

const STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:                   { bg: '#f1f3f9', color: '#4a5280', label: 'Pending' },
  generating:                { bg: '#dbeafe', color: '#1d4ed8', label: 'Generating…' },
  ready_for_internal_review: { bg: '#fff8e0', color: '#92400e', label: 'Needs review' },
  internal_approved:         { bg: '#eff6ff', color: '#1d4ed8', label: 'Internally approved' },
  ready_for_approval:        { bg: '#f3e8ff', color: '#7c3aed', label: 'With client' },
  changes_requested:         { bg: '#fff4f3', color: '#b91c1c', label: 'Changes requested' },
  approved:                  { bg: '#f0fdf4', color: '#15803d', label: 'Approved' },
  published:                 { bg: '#f0fdf4', color: '#15803d', label: 'Published' },
  cancelled:                 { bg: '#f1f3f9', color: '#9ca3af', label: 'Cancelled' },
  error:                     { bg: '#fff4f3', color: '#b91c1c', label: 'Error' },
}

export default function StatusBadge({ status, small }: Props) {
  const style = STYLES[status] ?? { bg: '#f1f3f9', color: '#4a5280', label: status }
  return (
    <span
      className="inline-flex items-center gap-1 font-semibold rounded-full whitespace-nowrap"
      style={{
        background: style.bg,
        color: style.color,
        fontSize: small ? 10 : 11,
        padding: small ? '2px 8px' : '3px 10px',
      }}
    >
      {status === 'generating' && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#1d4ed8' }} />
      )}
      {style.label}
    </span>
  )
}
