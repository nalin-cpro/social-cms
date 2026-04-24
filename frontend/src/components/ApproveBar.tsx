import { useState } from 'react'
import { CheckCircle, MessageSquare, Loader2 } from 'lucide-react'
import { api } from '../api/client'
import { ContentItem } from '../types'

interface Props {
  item: ContentItem
  onUpdate: (updated: ContentItem) => void
  onApproved?: () => void
}

export default function ApproveBar({ item, onUpdate, onApproved }: Props) {
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'approved' | 'commented' | null>(null)

  if (item.status === 'approved') {
    return (
      <div
        className="flex items-center gap-2 text-sm font-medium px-5 py-4 rounded-xl"
        style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}
      >
        <CheckCircle size={16} />
        Approved — this content is ready to publish.
      </div>
    )
  }

  if (done === 'commented') {
    return (
      <div
        className="text-sm px-5 py-4 rounded-xl"
        style={{ background: '#f4f6fb', border: '1px solid #dde2f0', color: '#4a5280' }}
      >
        Thank you — your feedback has been passed to the team. We'll be in touch shortly.
      </div>
    )
  }

  const handleApprove = async () => {
    setSubmitting(true)
    try {
      const updated = await api.post<ContentItem>(`/content/${item.id}/approve`)
      onUpdate(updated)
      setDone('approved')
      onApproved?.()
    } finally {
      setSubmitting(false)
    }
  }

  const handleComment = async () => {
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      await api.post<ContentItem>(`/content/${item.id}/comment`, { comment })
      setDone('commented')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleApprove}
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-lg transition-opacity disabled:opacity-50"
          style={{ background: '#f5b800', color: '#1a1f3a', fontSize: 14 }}
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
          Approve
        </button>
        <button
          onClick={() => setShowComment(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors"
          style={{ border: '1px solid #dde2f0', color: '#1a1f3a', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          <MessageSquare size={15} />
          Leave feedback
        </button>
      </div>

      {showComment && (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Leave a note for the team…"
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-sm resize-none outline-none transition"
            style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
            onFocus={e => (e.target.style.borderColor = '#1a2d82')}
            onBlur={e => (e.target.style.borderColor = '#dde2f0')}
          />
          <button
            onClick={handleComment}
            disabled={submitting || !comment.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ background: '#1a2d82', color: '#fff' }}
          >
            Submit feedback
          </button>
        </div>
      )}
    </div>
  )
}
