import { ContentStatus } from '../types'

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  pending:            { bg: '#fff8e0',  color: '#92400e' },
  generating:         { bg: '#f4f6fb',  color: '#4a5280' },
  ready_for_approval: { bg: '#e8eeff',  color: '#1a2d82' },
  changes_requested:  { bg: '#fff4f3',  color: '#b91c1c' },
  approved:           { bg: '#f0fdf4',  color: '#15803d' },
  published:          { bg: '#f3e8ff',  color: '#7e22ce' },
  error:              { bg: '#fff4f3',  color: '#b91c1c' },
}

const LABELS: Record<string, string> = {
  pending:            'Pending',
  generating:         'Generating…',
  ready_for_approval: 'Ready for Review',
  changes_requested:  'Feedback Received',
  approved:           'Approved',
  published:          'Published',
  error:              'Error',
}

export default function StatusBadge({ status }: { status: ContentStatus | string }) {
  const style = BADGE_STYLES[status] ?? { bg: '#f4f6fb', color: '#4a5280' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
      style={{ background: style.bg, color: style.color }}
    >
      {LABELS[status] ?? status}
    </span>
  )
}
