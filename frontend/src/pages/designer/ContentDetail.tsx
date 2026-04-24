import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { ContentItem, CopyJson } from '../../types'
import ImagePreview from '../../components/ImagePreview'
import CopyPreview from '../../components/CopyPreview'
import StatusBadge from '../../components/StatusBadge'
import { useToast } from '../../contexts/ToastContext'
import { ArrowLeft, Send, Loader2, AlertCircle } from 'lucide-react'

function CopyDiff({ original, revised }: { original: CopyJson; revised: CopyJson }) {
  const fields = Array.from(new Set([...Object.keys(original), ...Object.keys(revised)])).filter(
    k => !['copy_valid', 'violations'].includes(k)
  )

  return (
    <div className="space-y-4">
      {fields.map(field => {
        const orig = original[field as keyof CopyJson]
        const rev = revised[field as keyof CopyJson]
        const changed = JSON.stringify(orig) !== JSON.stringify(rev)
        const displayOrig = typeof orig === 'object' ? JSON.stringify(orig, null, 2) : String(orig ?? '')
        const displayRev = typeof rev === 'object' ? JSON.stringify(rev, null, 2) : String(rev ?? '')

        return (
          <div
            key={field}
            className="rounded-lg p-4"
            style={{
              border: changed ? '1px solid #f3cf78' : '1px solid #dde2f0',
              background: changed ? '#fff8e0' : '#fff',
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4a5280' }}>
              {field.replace(/_/g, ' ')}
            </p>
            {changed ? (
              <div className="space-y-2">
                <div>
                  <p className="text-xs mb-1" style={{ color: '#8892b8' }}>Original</p>
                  <p className="text-sm leading-relaxed line-through" style={{ color: 'rgba(26,31,58,0.4)' }}>{displayOrig}</p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: '#15803d' }}>Revised</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#1a1f3a' }}>{displayRev}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: '#1a1f3a' }}>{displayRev}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function DesignerContentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [item, setItem] = useState<ContentItem | null>(null)
  const [sending, setSending] = useState(false)
  const [showDiff, setShowDiff] = useState(false)

  useEffect(() => {
    if (id) api.get<ContentItem>(`/content/${id}`).then(setItem)
  }, [id])

  const sendToClient = async () => {
    if (!item) return
    setSending(true)
    try {
      const updated = await api.post<ContentItem>(`/content/${item.id}/send-to-client`)
      setItem(updated)
      toast(isRevision ? 'Revision approved and sent to client.' : 'Sent to client for review.')
    } finally {
      setSending(false)
    }
  }

  if (!item) return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8 flex items-center justify-center">
        <p className="text-sm" style={{ color: '#8892b8' }}>Loading…</p>
      </main>
    </div>
  )

  const hasImages = item.feed_post_url || item.story_1_url || item.story_2_url || item.lifestyle_url
  const isRevision = item.status === 'changes_requested'
  const hasDiff = isRevision && item.original_copy_json && item.copy_json

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm mb-6 transition-colors"
          style={{ color: '#8892b8' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#1a1f3a')}
          onMouseLeave={e => (e.currentTarget.style.color = '#8892b8')}
        >
          <ArrowLeft size={15} />
          Back
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#1a1f3a' }}>{item.product_name}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#4a5280' }}>
              {item.campaign} · {item.channel} · {item.scheduled_date}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={item.status} />
            {(item.status === 'changes_requested' || item.status === 'ready_for_approval') && (
              <button
                onClick={sendToClient}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 transition-opacity"
                style={{ background: '#f5b800', color: '#1a1f3a' }}
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {isRevision ? 'Approve revision & send' : 'Send to Client'}
              </button>
            )}
          </div>
        </div>

        {/* Client feedback panel */}
        {isRevision && item.client_comment && (
          <div
            className="mb-6 rounded-xl p-5"
            style={{ background: '#fff8e0', border: '1px solid #f3cf78' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={15} style={{ color: '#D97706' }} />
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#D97706' }}>
                Client Feedback
              </p>
            </div>
            <p className="text-sm" style={{ color: '#1a1f3a' }}>{item.client_comment}</p>
            <p className="text-xs mt-2" style={{ color: '#92400e' }}>
              Copy has been revised to address this feedback. Review the changes below, then send to client when ready.
            </p>
            {hasDiff && (
              <button
                onClick={() => setShowDiff(v => !v)}
                className="mt-3 text-xs font-semibold underline"
                style={{ color: '#1a2d82' }}
              >
                {showDiff ? 'Hide diff' : 'Show what changed'}
              </button>
            )}
          </div>
        )}

        <div
          className="rounded-xl p-6"
          style={{ background: '#fff', border: '1px solid #dde2f0' }}
        >
          <div className="grid grid-cols-2 gap-8">
            {hasImages && (
              <div className="space-y-6">
                <h2 className="text-sm font-semibold" style={{ color: '#1a1f3a' }}>Images</h2>
                {item.feed_post_url && <ImagePreview url={item.feed_post_url} label="Feed Post" aspect="square" />}
                <div className="grid grid-cols-2 gap-4">
                  {item.story_1_url && <ImagePreview url={item.story_1_url} label="Story 1" aspect="story" />}
                  {item.story_2_url && <ImagePreview url={item.story_2_url} label="Story 2" aspect="story" />}
                </div>
                {item.lifestyle_url && <ImagePreview url={item.lifestyle_url} label="Lifestyle" aspect="square" />}
              </div>
            )}

            <div className={hasImages ? '' : 'col-span-2 max-w-2xl'}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: '#1a1f3a' }}>
                {showDiff && hasDiff ? 'Copy — Changes' : 'Copy'}
              </h2>
              {showDiff && hasDiff ? (
                <CopyDiff original={item.original_copy_json!} revised={item.copy_json!} />
              ) : (
                item.copy_json
                  ? <CopyPreview copy={item.copy_json} channel={item.channel} />
                  : <p className="text-sm" style={{ color: '#8892b8' }}>No copy generated yet</p>
              )}
              {item.qc_score !== null && (
                <div className="mt-6 pt-4" style={{ borderTop: '1px solid #dde2f0' }}>
                  <p className="text-xs" style={{ color: '#8892b8' }}>QC Score: {item.qc_score}/10</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
