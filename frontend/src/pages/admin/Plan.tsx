import { useEffect, useState, useRef, useMemo } from 'react'
import Sidebar from '../../components/Sidebar'
import StatusBadge from '../../components/StatusBadge'
import PostDrawer from '../../components/PostDrawer'
import { api } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { ContentItem, Campaign, Brand, ContentStatus } from '../../types'
import {
  ChevronDown, ChevronRight, Plus, Calendar, Sparkles, Upload,
  Send, X, Loader2, Check, Bot, User as UserIcon, ChevronLeft, AlertCircle,
} from 'lucide-react'

// ── Design tokens ─────────────────────────────────────────────────────────────
const NAVY = '#1a2d82'
const GOLD = '#f5b800'

// ── Channel config ────────────────────────────────────────────────────────────
const CHANNELS_P1 = [
  { key: 'instagram_post',    label: 'Instagram Post' },
  { key: 'instagram_stories', label: 'Instagram Stories' },
  { key: 'facebook_post',     label: 'Facebook Post' },
  { key: 'email',             label: 'Email' },
  { key: 'tiktok',            label: 'TikTok' },
]
const CHANNELS_P2 = [
  { key: 'youtube',           label: 'YouTube' },
  { key: 'youtube_shorts',    label: 'YT Shorts' },
  { key: 'youtube_video',     label: 'YT Video' },
]

const CHANNEL_COLORS: Record<string, { bg: string; color: string }> = {
  instagram_post:    { bg: '#fce7f3', color: '#9d174d' },
  instagram_stories: { bg: '#fce7f3', color: '#9d174d' },
  tiktok:            { bg: '#f0fdf4', color: '#166534' },
  email:             { bg: '#eff6ff', color: '#1d4ed8' },
  facebook_post:     { bg: '#eff6ff', color: '#1d4ed8' },
}

// ── Week helpers ──────────────────────────────────────────────────────────────
interface WeekRange { start: Date; end: Date; label: string }

function getWeeksForMonth(year: number, month: number): WeekRange[] {
  const weeks: WeekRange[] = []
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  let cursor = new Date(first)
  while (cursor <= last) {
    const start = new Date(cursor)
    const end   = new Date(cursor)
    end.setDate(end.getDate() + 6)
    if (end > last) { end.setTime(last.getTime()) }
    const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`
    weeks.push({ start, end, label: `${fmt(start)} – ${fmt(end)}` })
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

function getCurrentWeekIndex(year: number, month: number): number {
  const weeks = getWeeksForMonth(year, month)
  const today = new Date()
  const idx = weeks.findIndex(w => today >= w.start && today <= w.end)
  return idx >= 0 ? idx : 0
}

function campaignInWeek(campaign: Campaign, week: WeekRange): boolean {
  if (!campaign.posts || campaign.posts.length === 0) return true
  return campaign.posts.some(p => {
    if (!p.scheduled_date) return false
    const d = new Date(p.scheduled_date)
    return d >= week.start && d <= week.end
  })
}

// ── Status badge for campaigns ────────────────────────────────────────────────
function CampaignStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    active:         { bg: '#e8f8ef', color: '#0f7b3f', label: 'Active' },
    draft:          { bg: '#fffbeb', color: '#92400e', label: 'Draft' },
    sent_to_client: { bg: '#eff6ff', color: '#1d4ed8', label: 'Sent to client' },
    complete:       { bg: '#f4f6fb', color: '#4a5280', label: 'Complete' },
  }
  const s = styles[status] ?? styles.draft
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={s}>
      {s.label}
    </span>
  )
}

function ChannelBadge({ channel }: { channel: string }) {
  const s = CHANNEL_COLORS[channel] ?? { bg: '#f1f3f9', color: '#4a5280' }
  const label = channel.replace('instagram_', 'IG ').replace(/_/g, ' ')
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize" style={s}>
      {label}
    </span>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-xl px-5 py-4 flex-1 min-w-0" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
      <p className="text-xs font-semibold mb-1" style={{ color: '#8892b8' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent ?? '#1a1f3a' }}>{value}</p>
    </div>
  )
}

// ── Post row inside campaign card ─────────────────────────────────────────────
function PostRow({ item, onClick }: { item: ContentItem; onClick: () => void }) {
  const borderColor: Record<string, string> = {
    changes_requested: '#DC2626',
    ready_for_internal_review: '#D97706',
    approved: '#16A34A',
    published: '#16A34A',
  }
  const left = borderColor[item.status] ?? 'transparent'

  const needsReview = item.status === 'changes_requested' || item.status === 'ready_for_internal_review'
  const needsGenerate = item.status === 'pending' && !item.feed_post_url
  const isApproved = item.status === 'approved' || item.status === 'published'

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
      style={{ borderLeft: `3px solid ${left}`, borderBottom: '1px solid #f4f6fb' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f8f9ff')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Thumbnail */}
      <div className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden"
        style={{ background: '#e8ebf5' }}>
        {item.feed_post_url
          ? <img src={item.feed_post_url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          : <div className="w-full h-full flex items-center justify-center" style={{ color: '#8892b8', fontSize: 10, fontWeight: 600 }}>
              {item.channel.slice(0, 2).toUpperCase()}
            </div>
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" style={{ fontSize: 12, color: '#1a1f3a' }}>{item.product_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <ChannelBadge channel={item.channel} />
          {item.scheduled_date && (
            <span style={{ fontSize: 10, color: '#8892b8' }}>
              {new Date(item.scheduled_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      <StatusBadge status={item.status as ContentStatus} />

      {/* Action button */}
      <button
        onClick={onClick}
        className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg ml-1"
        style={needsReview
          ? { background: '#e8f8ef', color: '#0f7b3f' }
          : needsGenerate
          ? { background: NAVY, color: '#fff' }
          : { background: '#f4f6fb', color: '#4a5280' }}
      >
        {needsReview ? 'Review →' : needsGenerate ? '▸ Generate' : 'View'}
      </button>
    </div>
  )
}

// ── Delete confirmation dialog ────────────────────────────────────────────────
function DeleteConfirmDialog({
  campaignName, postCount, onConfirm, onCancel, deleting,
}: {
  campaignName: string; postCount: number; onConfirm: () => void; onCancel: () => void; deleting: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl overflow-hidden w-full max-w-sm mx-4" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div className="px-6 pt-6 pb-2">
          <p className="text-base font-semibold mb-2" style={{ color: '#1a1f3a' }}>Delete "{campaignName}"?</p>
          <p className="text-sm" style={{ color: '#4a5280' }}>
            This will also delete all {postCount} post{postCount !== 1 ? 's' : ''} inside it that haven't been approved. This cannot be undone.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg"
            style={{ border: '1px solid #dde2f0', color: '#4a5280' }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
            style={{ background: '#DC2626', color: '#fff' }}>
            {deleting ? <Loader2 size={13} className="animate-spin" /> : null}
            Delete campaign
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Campaign card ─────────────────────────────────────────────────────────────
function CampaignCard({
  campaign, brandKey, isAdmin, onSendToClient, onDeleted, autoExpand,
}: {
  campaign: Campaign
  brandKey: string
  isAdmin: boolean
  onSendToClient: (c: Campaign) => void
  onDeleted: (id: number) => void
  autoExpand?: boolean
}) {
  const [open, setOpen] = useState(autoExpand ?? true)
  const [posts, setPosts] = useState<ContentItem[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  // Fetch posts on mount
  useEffect(() => {
    if (!brandKey) return
    setLoadingPosts(true)
    api.get<ContentItem[]>(`/content?brand=${brandKey}&campaign_id=${campaign.id}`)
      .then(items => setPosts(items))
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false))
  }, [campaign.id, brandKey])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/campaigns/${campaign.id}`)
      toast('Campaign deleted')
      onDeleted(campaign.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed'
      if (msg.includes('approved')) {
        toast('Cannot delete — this campaign has approved posts', 'error')
      } else {
        toast(msg, 'error')
      }
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const total    = posts.length
  const approved = posts.filter(p => ['approved', 'published'].includes(p.status)).length
  const attention = posts.filter(p => ['changes_requested', 'error'].includes(p.status)).length
  const progress = total > 0 ? Math.round((approved / total) * 100) : 0

  return (
    <>
      <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
        {/* Campaign header */}
        <div
          className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none"
          style={{ borderBottom: open ? '1px solid #dde2f0' : undefined }}
          onClick={() => setOpen(o => !o)}
        >
          <span style={{ color: '#8892b8' }}>
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate" style={{ color: '#1a1f3a' }}>{campaign.name}</p>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            {campaign.theme && (
              <p className="text-xs mt-0.5 truncate" style={{ color: '#8892b8' }}>{campaign.theme}</p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
            {total > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full" style={{ background: '#e8ebf5' }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${progress}%`, background: progress === 100 ? '#16A34A' : NAVY }} />
                </div>
                <span className="text-xs" style={{ color: '#8892b8' }}>{approved}/{total}</span>
              </div>
            )}
            {attention > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#fff4f3', color: '#b91c1c' }}>
                <AlertCircle size={10} /> {attention}
              </span>
            )}
            {isAdmin && campaign.status === 'draft' && (
              <button
                onClick={() => onSendToClient(campaign)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg"
                style={{ background: NAVY, color: '#fff' }}
              >
                <Send size={11} /> Send to client
              </button>
            )}
            {/* ⋯ overflow menu */}
            {isAdmin && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(m => !m)}
                  className="p-1.5 rounded-lg text-xs font-bold leading-none"
                  style={{ color: '#8892b8', background: menuOpen ? '#f4f6fb' : 'transparent' }}
                >
                  ⋯
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden"
                    style={{ background: '#fff', border: '1px solid #dde2f0', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: 160 }}>
                    <button className="w-full text-left px-4 py-2.5 text-sm"
                      style={{ color: '#1a1f3a' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => setMenuOpen(false)}>
                      Edit brief
                    </button>
                    <button className="w-full text-left px-4 py-2.5 text-sm"
                      style={{ color: '#1a1f3a' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => setMenuOpen(false)}>
                      Duplicate campaign
                    </button>
                    <div style={{ height: 1, background: '#dde2f0', margin: '4px 0' }} />
                    <button className="w-full text-left px-4 py-2.5 text-sm font-medium"
                      style={{ color: '#DC2626' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fff4f3')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}>
                      Delete campaign
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Posts */}
        {open && (
          <div>
            {loadingPosts ? (
              [1, 2, 3].map(i => (
                <div key={i} className="px-4 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid #f4f6fb' }}>
                  <div className="w-9 h-9 rounded-lg animate-pulse flex-shrink-0" style={{ background: '#e8ebf5' }} />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 rounded animate-pulse w-2/3" style={{ background: '#e8ebf5' }} />
                    <div className="h-2.5 rounded animate-pulse w-1/3" style={{ background: '#e8ebf5' }} />
                  </div>
                  <div className="h-5 w-16 rounded-full animate-pulse" style={{ background: '#e8ebf5' }} />
                </div>
              ))
            ) : posts.length === 0 ? (
              <p className="px-5 py-4 text-sm" style={{ color: '#8892b8' }}>No posts yet for this campaign.</p>
            ) : (
              posts.map(item => (
                <PostRow key={item.id} item={item} onClick={() => setSelectedItem(item)} />
              ))
            )}
          </div>
        )}
      </div>

      {selectedItem && user && (
        <PostDrawer
          item={selectedItem}
          currentUser={user}
          onClose={() => setSelectedItem(null)}
          onUpdate={updated => setSelectedItem(updated)}
        />
      )}

      {confirmDelete && (
        <DeleteConfirmDialog
          campaignName={campaign.name}
          postCount={total}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
          deleting={deleting}
        />
      )}
    </>
  )
}

// ── AI Planner panel ──────────────────────────────────────────────────────────
interface ChatMessage { role: 'user' | 'assistant'; content: string }

function AIPlannerPanel({
  brandKey, campaigns, onClose, onCampaignCreated,
}: {
  brandKey: string
  campaigns: Campaign[]
  onClose: () => void
  onCampaignCreated: (c: Campaign) => void
}) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const draftCount = campaigns.filter(c => c.status === 'draft').length

  const openingMsg = useMemo(() => {
    if (campaigns.length === 0) return "Hi! I'm your AI campaign planner. Tell me what you'd like to create and I'll help you build a campaign plan."
    if (draftCount > 0) return `You have ${draftCount} draft campaign${draftCount > 1 ? 's' : ''} in progress. Want me to help complete them, or start something new?`
    return `You have ${campaigns.length} active campaign${campaigns.length > 1 ? 's' : ''}. What would you like to plan next?`
  }, [campaigns, draftCount])

  const suggestions = useMemo(() => {
    const base = ['Suggest posts for next week', 'What channels are underused?', 'Create a product launch campaign']
    if (draftCount > 0) base.unshift('Help me finish my draft campaigns')
    return base.slice(0, 3)
  }, [draftCount])

  useEffect(() => {
    setMessages([{ role: 'assistant', content: openingMsg }])
  }, [openingMsg])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text: string) => {
    if (!text.trim() || sending) return
    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)
    try {
      const history = messages.slice(-6)
      const res = await api.post<{ reply: string }>('/ai/plan-chat', {
        brand_key: brandKey,
        message: text,
        context: { campaigns: campaigns.map(c => ({ id: c.id, name: c.name, status: c.status })) },
        history,
      })
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }])
    } catch {
      toast('AI response failed', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed top-0 right-0 h-full flex flex-col z-40"
      style={{ width: 380, background: '#fff', borderLeft: '1px solid #dde2f0', boxShadow: '-4px 0 24px rgba(0,0,0,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #dde2f0', background: NAVY }}>
        <div className="flex items-center gap-2.5">
          <Sparkles size={16} style={{ color: GOLD }} />
          <p className="text-sm font-semibold text-white">AI Campaign Planner</p>
        </div>
        <button onClick={onClose} className="p-1 rounded" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: m.role === 'assistant' ? NAVY : '#e8ebf5' }}>
              {m.role === 'assistant'
                ? <Bot size={12} style={{ color: GOLD }} />
                : <UserIcon size={12} style={{ color: '#4a5280' }} />}
            </div>
            <div
              className="text-sm px-3 py-2 rounded-xl max-w-[280px]"
              style={m.role === 'assistant'
                ? { background: '#f4f6fb', color: '#1a1f3a' }
                : { background: NAVY, color: '#fff' }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: NAVY }}>
              <Bot size={12} style={{ color: GOLD }} />
            </div>
            <div className="px-3 py-2 rounded-xl" style={{ background: '#f4f6fb' }}>
              <Loader2 size={14} className="animate-spin" style={{ color: '#8892b8' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5 flex-shrink-0">
          {suggestions.map(s => (
            <button key={s} onClick={() => send(s)}
              className="text-xs px-3 py-1.5 rounded-full border transition-colors"
              style={{ border: `1px solid ${NAVY}`, color: NAVY }}
              onMouseEnter={e => { e.currentTarget.style.background = NAVY; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = NAVY }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #dde2f0' }}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Ask anything about your campaigns…"
            className="flex-1 px-3 py-2 text-sm rounded-lg outline-none"
            style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            className="px-3 py-2 rounded-lg disabled:opacity-40"
            style={{ background: NAVY, color: '#fff' }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── New Campaign Modal ────────────────────────────────────────────────────────
function NewCampaignModal({
  brandKey, brands, onClose, onCreate,
}: {
  brandKey: string
  brands: Brand[]
  onClose: () => void
  onCreate: (c: Campaign) => void
}) {
  const { toast } = useToast()
  const [mode, setMode] = useState<'ai' | 'manual'>('ai')
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [name, setName] = useState('')
  const [theme, setTheme] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [p2Tooltip, setP2Tooltip] = useState<string | null>(null)

  const toggleChannel = (key: string) => {
    setSelectedChannels(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const generateFromAI = async () => {
    if (!description.trim()) return
    setGenerating(true)
    try {
      const res = await api.post<Campaign>('/ai/generate-campaign', {
        description, channels: selectedChannels, brand_key: brandKey,
        start_date: startDate || undefined, end_date: endDate || undefined,
      })
      onCreate(res)
      onClose()
      const postCount = res.posts?.length ?? 0
      toast(`Campaign created with ${postCount} post${postCount !== 1 ? 's' : ''} — ready to generate content`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to generate', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const saveManual = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await api.post<Campaign>('/campaigns', {
        brand_key: brandKey, name, theme,
        start_date: startDate || null, end_date: endDate || null,
        status: 'draft',
      })
      onCreate(res)
      onClose()
      toast('Campaign created')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl overflow-hidden w-full max-w-lg mx-4" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #dde2f0' }}>
          <p className="text-base font-semibold" style={{ color: '#1a1f3a' }}>New campaign</p>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: '#8892b8' }}><X size={16} /></button>
        </div>

        {/* Mode toggle */}
        <div className="px-6 pt-4">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#e8ebf5' }}>
            {(['ai', 'manual'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={mode === m
                  ? { background: '#fff', color: NAVY, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  : { color: '#4a5280', background: 'transparent' }}>
                {m === 'ai' ? <><Sparkles size={11} /> AI Describe</> : 'Manual'}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {mode === 'ai' ? (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>
                  Describe your campaign
                </label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                  style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
                  placeholder="e.g. Mother's Day promo for our skincare line, focus on gift sets, run for 2 weeks in May" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Start date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>End date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>Campaign name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                  style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
                  placeholder="e.g. Mother's Day 2026" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>Theme / goal</label>
                <input value={theme} onChange={e => setTheme(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                  style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
                  placeholder="e.g. Gift sets for mums" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Start date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>End date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
                </div>
              </div>
            </>
          )}

          {/* Channel grid */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#1a1f3a' }}>Channels</label>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS_P1.map(ch => {
                const active = selectedChannels.includes(ch.key)
                return (
                  <button key={ch.key} onClick={() => toggleChannel(ch.key)}
                    className="flex items-center justify-center px-2 py-2 rounded-lg text-xs font-medium border transition-all"
                    style={active
                      ? { background: '#e8eeff', color: NAVY, border: `1.5px solid ${NAVY}` }
                      : { background: '#fff', color: '#4a5280', border: '1px solid #dde2f0' }}>
                    {active && <Check size={10} className="mr-1 flex-shrink-0" />}
                    {ch.label}
                  </button>
                )
              })}
              {CHANNELS_P2.map(ch => (
                <div key={ch.key} className="relative">
                  <button
                    onClick={() => setP2Tooltip(p2Tooltip === ch.key ? null : ch.key)}
                    className="w-full flex items-center justify-center px-2 py-2 rounded-lg text-xs font-medium"
                    style={{ background: '#f9fafb', color: '#cbd5e1', border: '1px dashed #cbd5e1', opacity: 0.7 }}>
                    {ch.label}
                  </button>
                  {p2Tooltip === ch.key && (
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 px-2 py-1 rounded text-xs whitespace-nowrap"
                      style={{ background: '#1a1f3a', color: '#fff' }}>
                      Coming in Phase 2
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid #dde2f0' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg"
            style={{ border: '1px solid #dde2f0', color: '#4a5280' }}>
            Cancel
          </button>
          {mode === 'ai' ? (
            <button onClick={generateFromAI} disabled={!description.trim() || generating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
              style={{ background: NAVY, color: '#fff' }}>
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generate
            </button>
          ) : (
            <button onClick={saveManual} disabled={!name.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
              style={{ background: NAVY, color: '#fff' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Import Calendar Modal ─────────────────────────────────────────────────────
function ImportCalendarModal({ brandKey, onClose, onImported }: { brandKey: string; onClose: () => void; onImported: () => void }) {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const doImport = async () => {
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('brand_key', brandKey)
      if (file) fd.append('file', file)
      if (url) fd.append('url', url)
      const res = await api.postMultipart<{ imported: number; message: string }>('/holidays/import', fd)
      toast(res.message)
      onImported()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed', 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl overflow-hidden w-full max-w-md mx-4" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #dde2f0' }}>
          <p className="text-base font-semibold" style={{ color: '#1a1f3a' }}>Import calendar</p>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: '#8892b8' }}><X size={16} /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {/* Drag drop */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl cursor-pointer transition-colors"
            style={{ border: `2px dashed ${dragging ? NAVY : '#dde2f0'}`, background: dragging ? '#f0f3ff' : '#fafbff' }}>
            <Upload size={22} style={{ color: dragging ? NAVY : '#8892b8' }} />
            <p className="text-sm font-medium" style={{ color: '#1a1f3a' }}>
              {file ? file.name : 'Drop CSV file here or click to browse'}
            </p>
            <p className="text-xs" style={{ color: '#8892b8' }}>Accepts .csv with date, name columns</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: '#dde2f0' }} />
            <span className="text-xs font-medium" style={{ color: '#8892b8' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#dde2f0' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>Calendar URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
              placeholder="https://..." />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid #dde2f0' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg"
            style={{ border: '1px solid #dde2f0', color: '#4a5280' }}>Cancel</button>
          <button onClick={doImport} disabled={(!file && !url.trim()) || importing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
            style={{ background: NAVY, color: '#fff' }}>
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Import
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlanPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === 'admin'

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [weekIdx, setWeekIdx] = useState(() => getCurrentWeekIndex(now.getFullYear(), now.getMonth()))

  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandKey, setSelectedBrandKey] = useState(user?.brand_key ?? '')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  const [showNewModal, setShowNewModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [sendingClient, setSendingClient] = useState<number | null>(null)
  const [newCampaignId, setNewCampaignId] = useState<number | null>(null)

  const weeks = useMemo(() => getWeeksForMonth(year, month), [year, month])
  const selectedWeek = weeks[weekIdx] ?? weeks[0]

  const MONTHS_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // Load brands (admin only)
  useEffect(() => {
    if (!isAdmin) { setSelectedBrandKey(user?.brand_key ?? ''); return }
    api.get<Brand[]>('/brands').then(bs => {
      setBrands(bs)
      if (!selectedBrandKey && bs.length > 0) setSelectedBrandKey(bs[0].key)
    }).catch(() => {})
  }, [isAdmin])

  // Load campaigns
  useEffect(() => {
    if (!selectedBrandKey) return
    setLoading(true)
    api.get<Campaign[]>(`/campaigns?brand=${selectedBrandKey}`)
      .then(data => setCampaigns(data))
      .catch(() => toast('Failed to load campaigns', 'error'))
      .finally(() => setLoading(false))
  }, [selectedBrandKey])

  const filteredCampaigns = useMemo(() => {
    if (!selectedWeek) return campaigns
    // Without posts loaded at page level, show all campaigns (cards fetch their own posts)
    return campaigns
  }, [campaigns, selectedWeek])

  const stats = {
    campaigns: campaigns.length,
    totalPosts: 0,
    approved: 0,
    pending: 0,
    attention: 0,
  }

  const draftCampaigns = campaigns.filter(c => c.status === 'draft')

  const handleSendToClient = async (campaign: Campaign) => {
    setSendingClient(campaign.id)
    try {
      await api.post(`/campaigns/${campaign.id}/send-to-client`, {})
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: 'sent_to_client' } : c))
      toast('Sent to client for review')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to send', 'error')
    } finally {
      setSendingClient(null)
    }
  }

  const handleSendAllDrafts = async () => {
    for (const c of draftCampaigns) {
      await handleSendToClient(c)
    }
  }

  const navigateMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m); setYear(y); setWeekIdx(0)
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className={`flex-1 flex flex-col min-h-screen transition-all ${showAI ? 'mr-[380px]' : ''}`}>
        <div className="flex-1 p-8 max-w-5xl">

          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: '#1a1f3a' }}>Campaign Plan</h1>
              <p className="text-sm mt-0.5" style={{ color: '#4a5280' }}>
                {MONTHS_LABELS[month]} {year}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <button onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border"
                    style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#fff' }}>
                    <Upload size={14} /> Import calendar
                  </button>
                  <button onClick={() => setShowAI(s => !s)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border"
                    style={showAI
                      ? { border: `1px solid ${NAVY}`, color: NAVY, background: '#e8eeff' }
                      : { border: '1px solid #dde2f0', color: '#4a5280', background: '#fff' }}>
                    <Sparkles size={14} /> AI planner
                  </button>
                  <button onClick={() => setShowNewModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg"
                    style={{ background: NAVY, color: '#fff' }}>
                    <Plus size={14} /> New campaign
                  </button>
                </>
              )}
              {/* Brand selector for admins */}
              {isAdmin && brands.length > 1 && (
                <select value={selectedBrandKey} onChange={e => setSelectedBrandKey(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm outline-none ml-2"
                  style={{ border: '1px solid #dde2f0', color: '#1a1f3a', background: '#fff' }}>
                  {brands.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Client approval banner */}
          {isAdmin && draftCampaigns.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3.5 rounded-xl mb-5"
              style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <div className="flex items-center gap-2">
                <AlertCircle size={15} style={{ color: '#92400e' }} />
                <p className="text-sm font-medium" style={{ color: '#92400e' }}>
                  {draftCampaigns.length} draft campaign{draftCampaigns.length > 1 ? 's' : ''} need client approval
                </p>
              </div>
              <button onClick={handleSendAllDrafts} disabled={sendingClient !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg disabled:opacity-40"
                style={{ background: '#92400e', color: '#fff' }}>
                {sendingClient !== null ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Send to Justine
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-3 mb-6">
            <StatCard label="Campaigns" value={stats.campaigns} />
            <StatCard label="Total posts" value={stats.totalPosts} />
            <StatCard label="Approved" value={stats.approved} accent="#16A34A" />
            <StatCard label="Pending" value={stats.pending} accent={NAVY} />
            {stats.attention > 0 && <StatCard label="Attention" value={stats.attention} accent="#DC2626" />}
          </div>

          {/* Month navigation + week pills */}
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-lg"
              style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#fff' }}>
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-semibold" style={{ color: '#1a1f3a', minWidth: 100, textAlign: 'center' }}>
              {['January','February','March','April','May','June','July','August','September','October','November','December'][month]} {year}
            </span>
            <button onClick={() => navigateMonth(1)} className="p-1.5 rounded-lg"
              style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#fff' }}>
              <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} />
            </button>
            <div className="flex gap-1.5 ml-2 flex-wrap">
              {weeks.map((w, i) => (
                <button key={i} onClick={() => setWeekIdx(i)}
                  className="px-3 py-1.5 text-xs font-medium rounded-full transition-all"
                  style={weekIdx === i
                    ? { background: NAVY, color: '#fff' }
                    : { background: '#fff', color: '#4a5280', border: '1px solid #dde2f0' }}>
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Campaign list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#e8ebf5' }} />
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Calendar size={32} style={{ color: '#dde2f0' }} className="mb-3" />
              <p className="text-sm font-medium" style={{ color: '#4a5280' }}>No campaigns this week</p>
              <p className="text-xs mt-1" style={{ color: '#8892b8' }}>Select a different week or create a new campaign</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCampaigns.map(c => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  brandKey={selectedBrandKey}
                  isAdmin={isAdmin}
                  onSendToClient={handleSendToClient}
                  onDeleted={id => setCampaigns(prev => prev.filter(x => x.id !== id))}
                  autoExpand={c.id === newCampaignId}
                />
              ))}

              {/* Add campaign placeholder (admin only) */}
              {isAdmin && (
                <button onClick={() => setShowNewModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-medium transition-colors"
                  style={{ border: '2px dashed #dde2f0', color: '#8892b8', background: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = NAVY; e.currentTarget.style.color = NAVY }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#dde2f0'; e.currentTarget.style.color = '#8892b8' }}>
                  <Plus size={16} /> Add campaign
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* AI Planner side panel */}
      {showAI && selectedBrandKey && (
        <AIPlannerPanel
          brandKey={selectedBrandKey}
          campaigns={campaigns}
          onClose={() => setShowAI(false)}
          onCampaignCreated={c => setCampaigns(prev => [c, ...prev])}
        />
      )}

      {/* Modals */}
      {showNewModal && selectedBrandKey && (
        <NewCampaignModal
          brandKey={selectedBrandKey}
          brands={brands}
          onClose={() => setShowNewModal(false)}
          onCreate={c => {
            setCampaigns(prev => [c, ...prev])
            setNewCampaignId(c.id)
            setShowNewModal(false)
          }}
        />
      )}
      {showImportModal && selectedBrandKey && (
        <ImportCalendarModal
          brandKey={selectedBrandKey}
          onClose={() => setShowImportModal(false)}
          onImported={() => {}}
        />
      )}
    </div>
  )
}
