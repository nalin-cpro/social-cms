import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { ContentItem, ContentComment, CopyJson } from '../../types'
import StatusBadge from '../../components/StatusBadge'
import { useToast } from '../../contexts/ToastContext'
import { ArrowLeft, Send, ImageOff, CheckCircle, MessageSquare } from 'lucide-react'

type Tab = 'feed' | 'stories' | 'email'

function SafeImage({ src, alt, className, style }: { src: string; alt: string; className?: string; style?: React.CSSProperties }) {
  const [err, setErr] = useState(false)
  if (err) return (
    <div className={`flex items-center justify-center rounded-xl ${className ?? ''}`} style={{ background: '#f4f6fb', ...style }}>
      <ImageOff size={24} style={{ color: '#8892b8' }} />
    </div>
  )
  return <img src={src} alt={alt} onError={() => setErr(true)} className={`object-cover rounded-xl ${className ?? ''}`} style={style} />
}

function CopyBlock({ copy, channel }: { copy: CopyJson; channel: string }) {
  const ch = channel.toLowerCase()
  if (ch.includes('email')) {
    return (
      <div className="space-y-3 text-sm" style={{ color: '#1a1f3a' }}>
        {copy.subject_lines && <div><p className="text-xs font-semibold mb-1" style={{ color: '#8892b8' }}>Subject lines</p>{copy.subject_lines.map((s, i) => <p key={i} className="py-1">{s}</p>)}</div>}
        {copy.preview_text && <div><p className="text-xs font-semibold mb-1" style={{ color: '#8892b8' }}>Preview</p><p>{copy.preview_text}</p></div>}
        {copy.body_points && <div><p className="text-xs font-semibold mb-1" style={{ color: '#8892b8' }}>Body</p><ul className="list-disc list-inside space-y-1">{copy.body_points.map((b, i) => <li key={i}>{b}</li>)}</ul></div>}
        {copy.cta && <div><p className="text-xs font-semibold mb-1" style={{ color: '#8892b8' }}>CTA</p><p>{copy.cta}</p></div>}
      </div>
    )
  }
  return (
    <div className="space-y-3 text-sm" style={{ color: '#1a1f3a' }}>
      {copy.hook && <div><p className="text-xs font-semibold mb-1" style={{ color: '#8892b8' }}>Hook</p><p>{copy.hook}</p></div>}
      {copy.caption && <div><p className="text-xs font-semibold mb-1" style={{ color: '#8892b8' }}>Caption</p><p style={{ whiteSpace: 'pre-wrap' }}>{copy.caption}</p></div>}
      {copy.hashtags && <div><p className="text-xs font-semibold mb-1" style={{ color: '#8892b8' }}>Hashtags</p><p style={{ color: '#1d4ed8' }}>{copy.hashtags}</p></div>}
    </div>
  )
}

export default function ClientReviewDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [item, setItem] = useState<ContentItem | null>(null)
  const [comments, setComments] = useState<ContentComment[]>([])
  const [tab, setTab] = useState<Tab>('feed')
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    api.get<ContentItem>(`/content/${id}`).then(setItem)
    api.get<ContentComment[]>(`/content/${id}/comments`).then(setComments)
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  if (!item) return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8 flex items-center justify-center">
        <p className="text-sm" style={{ color: '#8892b8' }}>Loading…</p>
      </main>
    </div>
  )

  const ch = item.channel.toLowerCase()
  const hasEmail = ch.includes('email')
  const hasStories = !!(item.story_1_url || item.story_2_url)
  const hasFeed = !!(item.feed_post_url || item.lifestyle_url)

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'feed', label: 'Feed', show: hasFeed || !hasEmail },
    { key: 'stories', label: 'Stories', show: hasStories },
    { key: 'email', label: 'Email', show: hasEmail },
  ]

  const approve = async () => {
    setApproving(true)
    try {
      const updated = await api.post<ContentItem>(`/content/${item.id}/approve`, {})
      setItem(updated)
      toast('Approved!')
    } catch { toast('Failed to approve') }
    finally { setApproving(false) }
  }

  const sendFeedback = async () => {
    if (!feedback.trim()) return
    setSubmitting(true)
    try {
      const comment = await api.post<ContentComment>(`/content/${item.id}/comments`, { message: feedback, is_internal: false })
      setComments(prev => [...prev, comment])
      const updated = await api.get<ContentItem>(`/content/${item.id}`)
      setItem(updated)
      setFeedback('')
      toast('Feedback sent')
    } catch { toast('Failed to send feedback') }
    finally { setSubmitting(false) }
  }

  const canApprove = item.status === 'ready_for_approval'
  const canComment = item.status === 'ready_for_approval' || item.status === 'changes_requested'

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-xs mb-5 transition-colors"
            style={{ color: '#8892b8' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#1a1f3a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#8892b8')}
          >
            <ArrowLeft size={13} />
            Back to review list
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: '#1a1f3a' }}>{item.product_name}</h1>
              <p className="text-sm mt-0.5" style={{ color: '#4a5280' }}>
                {item.campaign} · {item.channel} · {item.scheduled_date ?? 'No date'}
              </p>
            </div>
            <StatusBadge status={item.status} />
          </div>
        </div>

        <div className="px-8 pb-8 grid grid-cols-[1fr_340px] gap-6">
          {/* Left: images + copy */}
          <div className="space-y-4">
            {/* Channel tabs */}
            {tabs.filter(t => t.show).length > 1 && (
              <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: '#e8ebf5' }}>
                {tabs.filter(t => t.show).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className="px-4 py-1.5 rounded-md text-xs font-semibold transition-all"
                    style={tab === t.key
                      ? { background: '#fff', color: '#1a2d82', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                      : { color: '#4a5280', background: 'transparent' }
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-xl p-6 space-y-5" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
              {/* Feed tab */}
              {tab === 'feed' && (
                <div className="space-y-4">
                  {item.feed_post_url
                    ? <SafeImage src={item.feed_post_url} alt="Feed" className="w-full" style={{ maxHeight: 480 }} />
                    : <div className="rounded-xl flex items-center justify-center" style={{ height: 320, background: '#f4f6fb' }}><ImageOff size={32} style={{ color: '#8892b8' }} /></div>
                  }
                  {item.lifestyle_url && <SafeImage src={item.lifestyle_url} alt="Lifestyle" className="w-full" style={{ maxHeight: 320 }} />}
                </div>
              )}

              {/* Stories tab */}
              {tab === 'stories' && (
                <div className="grid grid-cols-2 gap-4">
                  {item.story_1_url && <SafeImage src={item.story_1_url} alt="Story 1" className="w-full" style={{ aspectRatio: '9/16' }} />}
                  {item.story_2_url && <SafeImage src={item.story_2_url} alt="Story 2" className="w-full" style={{ aspectRatio: '9/16' }} />}
                </div>
              )}

              {/* Email tab */}
              {tab === 'email' && (
                <div className="max-w-lg mx-auto space-y-4">
                  {item.feed_post_url && <SafeImage src={item.feed_post_url} alt="Email banner" className="w-full rounded-xl" />}
                </div>
              )}

              {item.copy_json && (
                <div style={{ borderTop: '1px solid #dde2f0', paddingTop: 16 }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: '#8892b8' }}>COPY</p>
                  <CopyBlock copy={item.copy_json} channel={item.channel} />
                </div>
              )}
            </div>
          </div>

          {/* Right: actions + comments */}
          <div className="space-y-4">
            {/* Approve card */}
            {canApprove && (
              <div className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#1a1f3a' }}>Ready for approval</p>
                <p className="text-xs mb-4" style={{ color: '#4a5280' }}>Once approved, this content will be published on the scheduled date.</p>
                <button
                  onClick={approve}
                  disabled={approving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: '#f5b800', color: '#1a1f3a' }}
                >
                  <CheckCircle size={15} />
                  {approving ? 'Approving…' : 'Approve content'}
                </button>
              </div>
            )}

            {item.status === 'approved' && (
              <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <CheckCircle size={16} style={{ color: '#15803d' }} />
                <p className="text-sm font-medium" style={{ color: '#15803d' }}>Approved — ready to publish</p>
              </div>
            )}

            {item.status === 'changes_requested' && (
              <div className="rounded-xl px-5 py-4" style={{ background: '#fff8e0', border: '1px solid #f3cf78' }}>
                <p className="text-sm font-medium" style={{ color: '#92400e' }}>Feedback received</p>
                <p className="text-xs mt-1" style={{ color: '#92400e' }}>Our team is working on your revision.</p>
              </div>
            )}

            {/* Comments */}
            <div className="rounded-xl flex flex-col" style={{ background: '#fff', border: '1px solid #dde2f0', minHeight: 300 }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #dde2f0' }}>
                <MessageSquare size={14} style={{ color: '#1a2d82' }} />
                <p className="text-xs font-semibold" style={{ color: '#1a1f3a' }}>Comments</p>
              </div>

              <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto" style={{ maxHeight: 320 }}>
                {comments.length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: '#8892b8' }}>No comments yet</p>
                )}
                {comments.map(c => {
                  const isClient = c.sender_role === 'client'
                  return (
                    <div key={c.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="rounded-xl px-3 py-2 max-w-[85%]"
                        style={isClient
                          ? { background: '#1a2d82', color: '#fff' }
                          : { background: '#f4f6fb', color: '#1a1f3a' }
                        }
                      >
                        <p className="text-xs font-semibold mb-0.5" style={{ opacity: 0.7 }}>
                          {isClient ? 'You' : 'Progility Team'}
                        </p>
                        <p className="text-xs" style={{ lineHeight: 1.5 }}>{c.message}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {canComment && (
                <div className="px-4 pb-4 pt-2 flex gap-2" style={{ borderTop: '1px solid #dde2f0' }}>
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="Leave feedback…"
                    rows={2}
                    className="flex-1 resize-none rounded-lg px-3 py-2 text-xs outline-none"
                    style={{ border: '1px solid #dde2f0', color: '#1a1f3a', lineHeight: 1.5 }}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendFeedback() }}
                  />
                  <button
                    onClick={sendFeedback}
                    disabled={submitting || !feedback.trim()}
                    className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 self-end disabled:opacity-40 transition-opacity"
                    style={{ background: '#1a2d82' }}
                  >
                    <Send size={13} style={{ color: '#fff' }} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
