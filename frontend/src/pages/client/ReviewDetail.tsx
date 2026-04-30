import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Check, Send, ImageOff, Loader2, ChevronLeft } from 'lucide-react'
import { ContentItem, ContentComment } from '../../types'
import { api } from '../../api/client'

const NAVY = '#1a2d82'
const GOLD = '#f5b800'
const BASE_URL = import.meta.env.VITE_API_BASE || ''

// ── Safe image ────────────────────────────────────────────────────────────────

function SafeImage({ src, alt, className, style }: {
  src: string | null | undefined
  alt: string
  className?: string
  style?: React.CSSProperties
}) {
  const [broken, setBroken] = useState(false)
  const resolved = src?.startsWith('/') ? `${BASE_URL}${src}` : src

  if (!src || broken) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 ${className || ''}`}
        style={{ background: '#f4f6fb', border: '1px dashed #dde2f0', minHeight: 200, borderRadius: 12, ...style }}
      >
        <ImageOff size={28} style={{ color: '#dde2f0' }} />
        <p className="text-xs text-center px-4" style={{ color: '#8892b8' }}>
          Image coming soon — check back shortly
        </p>
      </div>
    )
  }
  return (
    <img src={resolved || ''} alt={alt} className={className} style={style} onError={() => setBroken(true)} />
  )
}

// ── Copy blocks ───────────────────────────────────────────────────────────────

function CaptionBlock({ copy }: { copy: Record<string, unknown> }) {
  const caption = copy.caption as string | undefined
  const hashtags = (copy.hashtags as string[] | undefined)?.join(' ')
  const hook = copy.hook as string | undefined
  return (
    <div className="space-y-2">
      {hook && <p className="text-sm font-semibold" style={{ color: '#1a1f3a' }}>{hook}</p>}
      {caption && <p className="text-sm leading-relaxed" style={{ color: '#1a1f3a' }}>{caption}</p>}
      {hashtags && <p className="text-xs" style={{ color: '#8892b8' }}>{hashtags}</p>}
    </div>
  )
}

function EmailBlock({ copy }: { copy: Record<string, unknown> }) {
  const subjects = copy.subject_lines as string[] | undefined
  const preview = copy.preview_text as string | undefined
  const body = copy.body as string | undefined
  const cta = copy.cta as string | undefined
  return (
    <div className="space-y-4">
      <div className="rounded-lg p-3" style={{ background: '#fff8e0', border: '1px solid #fde68a' }}>
        <p className="text-xs font-semibold mb-1" style={{ color: '#92400e' }}>Email campaign</p>
        <p className="text-xs" style={{ color: '#92400e' }}>
          This email template will be sent via Klaviyo using your brand template.
        </p>
      </div>
      {subjects && subjects.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#8892b8' }}>Subject lines</p>
          {subjects.map((s, i) => (
            <p key={i} className={`text-sm mb-1 ${i === 0 ? 'font-semibold' : ''}`} style={{ color: '#1a1f3a' }}>
              {i === 0 ? '★ ' : '○ '}{s}
            </p>
          ))}
        </div>
      )}
      {preview && <p className="text-sm italic" style={{ color: '#8892b8' }}>{preview}</p>}
      {body && (
        <div className="text-sm leading-relaxed pl-4" style={{ borderLeft: `3px solid #dde2f0`, color: '#1a1f3a' }}>
          {body}
        </div>
      )}
      {cta && (
        <span className="inline-block text-sm font-semibold px-4 py-2 rounded-lg"
          style={{ background: GOLD, color: '#1a1f3a' }}>
          {cta}
        </span>
      )}
    </div>
  )
}

// ── Thread ────────────────────────────────────────────────────────────────────

function Thread({ comments }: { comments: ContentComment[] }) {
  return (
    <div className="space-y-3">
      {comments.map(comment => {
        const isTeam = comment.sender_role !== 'client'
        const time = new Date(comment.created_at).toLocaleString([], {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
        return (
          <div key={comment.id} className={`flex gap-2 ${isTeam ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={isTeam
                ? { background: NAVY, color: '#fff' }
                : { background: '#f4f6fb', color: NAVY, border: '1px solid #dde2f0' }}>
              {isTeam ? 'P' : 'Me'}
            </div>
            <div className={`max-w-[80%] flex flex-col gap-0.5 ${isTeam ? 'items-end' : 'items-start'}`}>
              <div className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                style={isTeam
                  ? { background: NAVY, color: '#fff', borderBottomRightRadius: 4 }
                  : { background: '#f4f6fb', color: '#1a1f3a', border: '1px solid #dde2f0', borderBottomLeftRadius: 4 }}>
                {comment.message}
              </div>
              <p className="text-xs" style={{ color: '#8892b8' }}>
                {isTeam ? 'Progility' : 'You'} · {time}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [item, setItem] = useState<ContentItem | null>(null)
  const [comments, setComments] = useState<ContentComment[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'feed' | 'stories' | 'email'>('feed')
  const [feedbackText, setFeedbackText] = useState('')
  const [sending, setSending] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<ContentItem>(`/content/${id}`),
      api.get<ContentComment[]>(`/content/${id}/comments`),
    ]).then(([fetchedItem, cmts]) => {
      setItem(fetchedItem)
      setComments(cmts.filter(c => !c.is_internal && !c.is_ai_revision))
      setApproved(fetchedItem.status === 'approved')
      if (fetchedItem.channel === 'email') setTab('email')
    }).catch(() => navigate('/client/review'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  const handleApprove = async () => {
    if (!item) return
    setApproving(true)
    try {
      await api.post(`/content/${item.id}/approve`)
      setApproved(true)
      setItem(prev => prev ? { ...prev, status: 'approved' } : prev)
    } catch (e) { console.error(e) }
    finally { setApproving(false) }
  }

  const handleFeedback = async () => {
    if (!item || !feedbackText.trim()) return
    setSending(true)
    try {
      const comment = await api.post<ContentComment>(`/content/${item.id}/comments`, {
        message: feedbackText, is_internal: false,
      })
      setComments(prev => [...prev, comment])
      setFeedbackText('')
      setFeedbackSent(true)
      setTimeout(() => setFeedbackSent(false), 5000)
    } catch (e) { console.error(e) }
    finally { setSending(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={24} className="animate-spin" style={{ color: NAVY }} />
      </div>
    )
  }

  if (!item) return null

  const isEmail = item.channel === 'email'
  const hasStories = !!(item.story_1_url || item.story_2_url)
  const allTabs = [
    { id: 'feed' as const,    label: 'Feed post', show: !isEmail },
    { id: 'stories' as const, label: 'Stories',   show: !isEmail && hasStories },
    { id: 'email' as const,   label: 'Email',     show: isEmail },
  ].filter(t => t.show)

  return (
    <div className="min-h-screen" style={{ background: '#f4f6fb' }}>
      <div className="max-w-[540px] mx-auto px-4 py-6 pb-24">

        {/* Back */}
        <button onClick={() => navigate('/client/review')}
          className="flex items-center gap-1 text-xs mb-5 font-medium"
          style={{ color: '#8892b8' }}>
          <ChevronLeft size={14} /> All posts
        </button>

        {/* Header */}
        <div className="mb-5">
          <h1 className="text-base font-bold mb-1" style={{ color: '#1a1f3a' }}>{item.product_name}</h1>
          <p className="text-xs" style={{ color: '#8892b8' }}>
            {item.channel.replace(/_/g, ' ')} · {item.scheduled_date || 'No date'} · {item.campaign}
          </p>
          <div className="mt-2">
            <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
              style={approved
                ? { background: '#e8f8ef', color: '#0f7b3f' }
                : { background: '#f5f3ff', color: '#5b21b6' }}>
              {approved ? 'Approved' : 'Awaiting your review'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        {allTabs.length > 1 && (
          <div className="flex gap-1 mb-4 overflow-x-auto">
            {allTabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg"
                style={tab === t.id
                  ? { background: NAVY, color: '#fff' }
                  : { background: '#fff', color: '#4a5280', border: '1px solid #dde2f0' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Content card */}
        <div className="rounded-xl overflow-hidden mb-5" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
          {tab === 'feed' && !isEmail && (
            <div>
              <SafeImage src={item.feed_post_url} alt={item.product_name}
                className="w-full object-cover" style={{ aspectRatio: '1', display: 'block' }} />
              <div className="p-4 space-y-3">
                {item.qc_score != null && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#e8eeff', color: NAVY }}>
                    Quality: {Math.round(item.qc_score * 10)}
                  </span>
                )}
                {item.copy_json && <CaptionBlock copy={item.copy_json} />}
              </div>
            </div>
          )}

          {tab === 'stories' && !isEmail && (
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <SafeImage src={item.story_1_url} alt="Story 1"
                  className="w-full rounded-lg object-cover" style={{ aspectRatio: '9/16' }} />
                <SafeImage src={item.story_2_url} alt="Story 2"
                  className="w-full rounded-lg object-cover" style={{ aspectRatio: '9/16' }} />
              </div>
            </div>
          )}

          {tab === 'email' && isEmail && (
            <div className="p-4">
              {item.copy_json
                ? <EmailBlock copy={item.copy_json} />
                : <p className="text-xs text-center py-6" style={{ color: '#8892b8' }}>Copy not yet generated.</p>}
            </div>
          )}
        </div>

        {/* Thread */}
        {comments.length > 0 && (
          <div className="rounded-xl p-4 mb-5" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
            <p className="text-xs font-semibold mb-4 uppercase tracking-wide" style={{ color: '#8892b8' }}>Notes</p>
            <Thread comments={comments} />
            <div ref={commentsEndRef} />
          </div>
        )}

        {/* Feedback sent */}
        {feedbackSent && (
          <div className="rounded-xl px-4 py-3 mb-4 text-sm text-center"
            style={{ background: '#e8f8ef', color: '#0f7b3f', border: '1px solid #6ee7b7' }}>
            Thank you — we'll review your note and be in touch shortly.
          </div>
        )}

        {/* Approved confirmation */}
        {approved && (
          <div className="rounded-xl px-4 py-4 mb-4 text-center"
            style={{ background: '#e8f8ef', border: '1px solid #6ee7b7' }}>
            <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="#0f7b3f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
            </svg>
            <p className="text-sm font-semibold" style={{ color: '#0f7b3f' }}>Approved — thank you!</p>
          </div>
        )}

        {/* Feedback + approve */}
        {!approved && item.status === 'ready_for_approval' && (
          <div className="space-y-3">
            <textarea rows={3} value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              placeholder="Leave a note for the team…"
              className="w-full px-4 py-3 text-sm rounded-xl outline-none resize-none"
              style={{ border: '1px solid #dde2f0', color: '#1a1f3a', background: '#fff' }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleFeedback() }} />

            <button onClick={handleApprove} disabled={approving}
              className="flex items-center justify-center gap-2 w-full text-sm font-bold rounded-xl disabled:opacity-50"
              style={{ background: GOLD, color: '#1a1f3a', height: 48 }}>
              {approving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Approve
            </button>

            {feedbackText.trim() && (
              <button onClick={handleFeedback} disabled={sending}
                className="flex items-center justify-center gap-2 w-full text-sm font-semibold rounded-xl disabled:opacity-50"
                style={{ border: '1px solid #dde2f0', color: '#4a5280', height: 44, background: '#fff' }}>
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send feedback
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
