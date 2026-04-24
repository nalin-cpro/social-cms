import { useEffect, useState, useRef } from 'react'
import { X, ChevronRight, Send, Check, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { ContentItem, ContentComment, User } from '../types'
import { api } from '../api/client'
import StatusBadge from './StatusBadge'
import CopyPreview from './CopyPreview'

const NAVY = '#1a2d82'
const GOLD = '#f5b800'

interface Props {
  item: ContentItem | null
  currentUser: User
  onClose: () => void
  onUpdate: (item: ContentItem) => void
}

type Tab = 'feed' | 'stories' | 'email'

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div
      className="w-full flex flex-col items-center justify-center rounded-xl gap-2"
      style={{ background: '#f4f6fb', border: '1px dashed #dde2f0', minHeight: 200 }}
    >
      <span className="text-2xl font-bold" style={{ color: '#dde2f0' }}>
        {label.charAt(0).toUpperCase()}
      </span>
      <p className="text-xs" style={{ color: '#8892b8' }}>Image generating — check back soon</p>
    </div>
  )
}

function SafeImage({ src, alt, className, style }: { src: string | null | undefined; alt: string; className?: string; style?: React.CSSProperties }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return <ImagePlaceholder label={alt} />
  return (
    <img
      src={src} alt={alt}
      className={className} style={style}
      onError={() => setBroken(true)}
    />
  )
}

function CommentBubble({ comment, isClient }: { comment: ContentComment; isClient: boolean }) {
  const isTeam = comment.sender_role !== 'client'
  const time = new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = new Date(comment.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })

  return (
    <div className={`flex gap-2 mb-3 ${isTeam ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={isTeam ? { background: NAVY, color: '#fff' } : { background: '#f4f6fb', color: NAVY, border: `1px solid #dde2f0` }}
      >
        {isTeam ? 'P' : comment.sender_name.charAt(0).toUpperCase()}
      </div>
      <div className={`max-w-[75%] ${isTeam ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        <div
          className="px-3 py-2 rounded-xl text-sm leading-relaxed"
          style={isTeam
            ? { background: NAVY, color: '#fff', borderBottomRightRadius: 4 }
            : { background: '#f4f6fb', color: '#1a1f3a', border: '1px solid #dde2f0', borderBottomLeftRadius: 4 }
          }
        >
          {comment.message}
        </div>
        <p className="text-xs" style={{ color: '#8892b8' }}>
          {isTeam ? 'Progility' : comment.sender_name.split('@')[0]} · {date} {time}
        </p>
      </div>
    </div>
  )
}

export default function PostDrawer({ item, currentUser, onClose, onUpdate }: Props) {
  const [tab, setTab] = useState<Tab>('feed')
  const [comments, setComments] = useState<ContentComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [regenInstruction, setRegenInstruction] = useState('')
  const [showRegen, setShowRegen] = useState(false)
  const [suggestionModal, setSuggestionModal] = useState<'cancel' | 'edit' | null>(null)
  const [suggestionMsg, setSuggestionMsg] = useState('')
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const isAdmin = currentUser.role === 'admin'
  const isDesigner = currentUser.role === 'designer'
  const isClient = currentUser.role === 'client'

  useEffect(() => {
    if (!item) return
    setTab(item.channel.includes('email') ? 'email' : item.channel.includes('stor') ? 'stories' : 'feed')
    setComments([])
    setCommentText('')
    setShowRegen(false)
    api.get<ContentComment[]>(`/content/${item.id}/comments`).then(setComments).catch(() => {})
  }, [item?.id])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  if (!item) return null

  const doAction = async (action: string, endpoint: string, body?: Record<string, unknown>) => {
    setActionLoading(action)
    try {
      const updated = body
        ? await api.post<ContentItem>(endpoint, body)
        : await api.post<ContentItem>(endpoint)
      onUpdate(updated)
    } catch (e) {
      console.error(action, e)
    } finally {
      setActionLoading(null)
    }
  }

  const sendComment = async () => {
    if (!commentText.trim()) return
    setSendingComment(true)
    try {
      const comment = await api.post<ContentComment>(`/content/${item.id}/comments`, {
        message: commentText,
        is_internal: false,
      })
      setComments(prev => [...prev, comment])
      setCommentText('')
      if (isClient) {
        const updated = await api.get<ContentItem>(`/content/${item.id}`)
        onUpdate(updated)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSendingComment(false)
    }
  }

  const sendRegen = async () => {
    if (!regenInstruction.trim()) return
    setActionLoading('regen')
    try {
      const updated = await api.post<ContentItem>(`/content/${item.id}/regenerate-image`, {
        instruction: regenInstruction,
      })
      onUpdate(updated)
      setRegenInstruction('')
      setShowRegen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setActionLoading(null)
    }
  }

  const sendSuggestion = async () => {
    if (!suggestionMsg.trim() || !suggestionModal) return
    try {
      await api.post('/suggestions', {
        content_item_id: item.id,
        suggestion_type: suggestionModal === 'cancel' ? 'cancel' : 'edit',
        message: suggestionMsg,
      })
      setSuggestionModal(null)
      setSuggestionMsg('')
    } catch (e) {
      console.error(e)
    }
  }

  const hasFeed = item.feed_post_url
  const hasStories = item.story_1_url || item.story_2_url
  const isEmail = item.channel === 'email'

  const allTabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'feed', label: 'Feed post', show: !isEmail },
    { id: 'stories', label: 'Stories', show: !isEmail && (item.channel !== 'tiktok') },
    { id: 'email', label: 'Email', show: isEmail },
  ]
  const tabs = allTabs.filter(t => t.show)

  const statusBorderColor: Record<string, string> = {
    ready_for_internal_review: '#D97706',
    changes_requested: '#DC2626',
    approved: '#16A34A',
    default: 'transparent',
  }
  const borderColor = statusBorderColor[item.status] || statusBorderColor.default

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(15,26,80,0.3)' }} onClick={onClose} />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden"
        style={{ width: 700, background: '#fff', borderLeft: `3px solid ${borderColor || '#dde2f0'}`, boxShadow: '-4px 0 40px rgba(26,45,130,0.12)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #dde2f0' }}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-base truncate" style={{ color: '#1a1f3a' }}>{item.product_name}</h2>
              <StatusBadge status={item.status} small />
            </div>
            <p className="text-xs" style={{ color: '#8892b8' }}>
              {item.channel} · {item.scheduled_date || 'No date'} · {item.campaign}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg flex-shrink-0" style={{ color: '#8892b8' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex px-6 pt-3 gap-1 flex-shrink-0">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                style={tab === t.id
                  ? { background: NAVY, color: '#fff' }
                  : { color: '#4a5280', background: 'transparent' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Content preview */}
          {tab === 'feed' && !isEmail && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#8892b8' }}>Feed Post</p>
              <SafeImage src={item.feed_post_url} alt={item.product_name}
                className="w-full rounded-xl object-cover"
                style={{ maxHeight: 320 }}
              />
              {item.qc_score != null && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs" style={{ color: '#8892b8' }}>QC Score</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: item.qc_score >= 70 ? '#f0fdf4' : '#fff8e0', color: item.qc_score >= 70 ? '#15803d' : '#92400e' }}>
                    {Math.round(item.qc_score)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {tab === 'stories' && !isEmail && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#8892b8' }}>Stories</p>
              <div className="grid grid-cols-2 gap-3">
                <SafeImage src={item.story_1_url} alt="Story 1" className="w-full rounded-xl object-cover" style={{ aspectRatio: '9/16', maxHeight: 280 }} />
                <SafeImage src={item.story_2_url} alt="Story 2" className="w-full rounded-xl object-cover" style={{ aspectRatio: '9/16', maxHeight: 280 }} />
              </div>
            </div>
          )}

          {(tab === 'email' || isEmail) && (
            <div className="rounded-xl p-4" style={{ background: '#f4f6fb', border: '1px solid #dde2f0' }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={14} style={{ color: '#8892b8' }} />
                <p className="text-xs" style={{ color: '#8892b8' }}>Email content — no image preview. Copy is shown below.</p>
              </div>
              {item.copy_json?.subject_lines && (
                <div className="mb-2">
                  <p className="text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Subject lines</p>
                  {item.copy_json.subject_lines.map((s, i) => (
                    <p key={i} className="text-sm" style={{ color: '#1a1f3a' }}>• {s}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Copy */}
          {item.copy_json && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#8892b8' }}>Copy</p>
              <CopyPreview copy={item.copy_json} channel={item.channel} />
            </div>
          )}

          {/* Image regen (designer/admin only) */}
          {(isAdmin || isDesigner) && !isEmail && (
            <div>
              <button
                onClick={() => setShowRegen(!showRegen)}
                className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <RefreshCw size={12} />
                Image instructions
              </button>
              {showRegen && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {['warmer tones', 'wider shot', 'more lifestyle', 'remove background', 'better lighting'].map(s => (
                      <button key={s} onClick={() => setRegenInstruction(prev => prev ? `${prev}, ${s}` : s)}
                        className="text-xs px-2 py-1 rounded-full transition-colors"
                        style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#f4f6fb' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    value={regenInstruction}
                    onChange={e => setRegenInstruction(e.target.value)}
                    placeholder="Add instructions to refine this image…"
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                    style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
                  />
                  <button
                    onClick={sendRegen}
                    disabled={!regenInstruction.trim() || actionLoading === 'regen'}
                    className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                    style={{ background: NAVY, color: '#fff' }}
                  >
                    {actionLoading === 'regen' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Regenerate image
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Suggest to admin (designer only) */}
          {isDesigner && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#8892b8' }}>Suggest to admin</p>
              <div className="flex gap-2">
                <button onClick={() => setSuggestionModal('cancel')}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{ border: '1px solid #f5c2be', color: '#b91c1c', background: '#fff4f3' }}>
                  Suggest cancellation
                </button>
                <button onClick={() => setSuggestionModal('edit')}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#f4f6fb' }}>
                  Suggest plan edit
                </button>
              </div>
            </div>
          )}

          {/* Conversation thread */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: '#8892b8' }}>
              {isClient ? 'Notes' : 'Thread'}
            </p>
            {comments.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: '#8892b8' }}>No messages yet</p>
            )}
            {comments.map(c => <CommentBubble key={c.id} comment={c} isClient={isClient} />)}
            <div ref={commentsEndRef} />
          </div>
        </div>

        {/* Reply + actions footer */}
        <div className="flex-shrink-0 px-6 py-4 space-y-3" style={{ borderTop: '1px solid #dde2f0' }}>
          {/* Comment input */}
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder={isClient ? 'Leave a note for the team…' : 'Add a comment…'}
              className="flex-1 px-3 py-2 text-sm rounded-lg outline-none resize-none"
              style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendComment() }}
            />
            <button
              onClick={sendComment}
              disabled={!commentText.trim() || sendingComment}
              className="p-2 rounded-lg self-end flex-shrink-0 disabled:opacity-40"
              style={{ background: NAVY, color: '#fff' }}
            >
              {sendingComment ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>

          {/* Role-based action buttons */}
          <div className="flex gap-2 flex-wrap">
            {isAdmin && item.status === 'ready_for_internal_review' && (
              <button
                onClick={() => doAction('internal-approve', `/content/${item.id}/internal-approve`)}
                disabled={actionLoading === 'internal-approve'}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: NAVY, color: '#fff' }}
              >
                {actionLoading === 'internal-approve' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Approve internally
              </button>
            )}
            {(isAdmin || isDesigner) && (item.status === 'internal_approved' || item.status === 'ready_for_internal_review') && (
              <button
                onClick={() => doAction('send-to-client', `/content/${item.id}/send-to-client`)}
                disabled={actionLoading === 'send-to-client'}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: '#7c3aed', color: '#fff' }}
              >
                {actionLoading === 'send-to-client' ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                Send to client
              </button>
            )}
            {isClient && item.status === 'ready_for_approval' && (
              <button
                onClick={() => doAction('approve', `/content/${item.id}/approve`)}
                disabled={actionLoading === 'approve'}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: GOLD, color: '#1a1f3a' }}
              >
                {actionLoading === 'approve' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Approve
              </button>
            )}
            {isAdmin && !['cancelled', 'published'].includes(item.status) && (
              <button
                onClick={() => doAction('cancel', `/content/${item.id}/cancel`)}
                disabled={actionLoading === 'cancel'}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#fff' }}
              >
                Cancel
              </button>
            )}
          </div>

          {item.status === 'approved' && (
            <p className="text-xs text-center py-1 font-medium" style={{ color: '#15803d' }}>
              Approved — this content is ready to publish.
            </p>
          )}
        </div>
      </div>

      {/* Suggestion modal */}
      {suggestionModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ background: 'rgba(15,26,80,0.5)' }}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#1a1f3a' }}>
              {suggestionModal === 'cancel' ? 'Suggest cancellation' : 'Suggest plan edit'}
            </h3>
            <textarea
              rows={4}
              value={suggestionMsg}
              onChange={e => setSuggestionMsg(e.target.value)}
              placeholder="Explain your suggestion…"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none mb-3"
              style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setSuggestionModal(null); setSuggestionMsg('') }}
                className="text-sm px-4 py-2 rounded-lg" style={{ border: '1px solid #dde2f0', color: '#4a5280' }}>
                Cancel
              </button>
              <button onClick={sendSuggestion} disabled={!suggestionMsg.trim()}
                className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                style={{ background: NAVY, color: '#fff' }}>
                Submit suggestion
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
