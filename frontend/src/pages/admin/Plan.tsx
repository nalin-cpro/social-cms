import { useEffect, useState, useMemo } from 'react'
import Sidebar from '../../components/Sidebar'
import StatusBadge from '../../components/StatusBadge'
import PostDrawer from '../../components/PostDrawer'
import { api } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import {
  ContentItem, Campaign, Brand,
} from '../../types'
import {
  ChevronDown, ChevronRight, Plus, Calendar, List,
  Play, Loader2, X, Image as ImageIcon, Check,
} from 'lucide-react'

const NAVY = '#1a2d82'
const GOLD = '#f5b800'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const YEARS = ['2025', '2026', '2027']

const CHANNEL_COLORS: Record<string, { bg: string; color: string }> = {
  instagram_post:    { bg: '#fce7f3', color: '#9d174d' },
  instagram_stories: { bg: '#fce7f3', color: '#9d174d' },
  tiktok:            { bg: '#f0fdf4', color: '#166534' },
  email:             { bg: '#eff6ff', color: '#1d4ed8' },
  facebook:          { bg: '#eff6ff', color: '#1d4ed8' },
}

function ChannelBadge({ channel }: { channel: string }) {
  const s = CHANNEL_COLORS[channel] ?? { bg: '#f1f3f9', color: '#4a5280' }
  const label = channel.replace('instagram_', 'IG ').replace('_', ' ')
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize" style={s}>{label}</span>
  )
}

// ── Status border colour for plan rows ────────────────────────────────────────
function rowBorder(status: string): string {
  if (status === 'ready_for_internal_review') return '#D97706'
  if (status === 'changes_requested') return '#DC2626'
  if (status === 'approved' || status === 'published') return '#16A34A'
  return 'transparent'
}

// ── Campaign section ──────────────────────────────────────────────────────────
function CampaignSection({
  campaign, posts, isAdmin, onPostClick, onGenerate, generating,
}: {
  campaign: Campaign
  posts: ContentItem[]
  isAdmin: boolean
  onPostClick: (p: ContentItem) => void
  onGenerate: (id: number) => void
  generating: boolean
}) {
  const [open, setOpen] = useState(true)

  const approved = posts.filter(p => ['approved', 'published'].includes(p.status)).length
  const pct = posts.length ? Math.round((approved / posts.length) * 100) : 0

  return (
    <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid #dde2f0', background: '#fff' }}>
      {/* Campaign header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left"
        style={{ background: open ? '#f8f9ff' : '#fff', borderBottom: open ? '1px solid #dde2f0' : 'none' }}
      >
        {open ? <ChevronDown size={14} style={{ color: '#8892b8' }} /> : <ChevronRight size={14} style={{ color: '#8892b8' }} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: '#1a1f3a' }}>{campaign.name}</span>
            {campaign.theme && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(26,45,130,0.08)', color: NAVY }}>
                {campaign.theme}
              </span>
            )}
            {campaign.start_date && campaign.end_date && (
              <span className="text-xs" style={{ color: '#8892b8' }}>{campaign.start_date} → {campaign.end_date}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
          <div className="text-right hidden md:block">
            <p className="text-xs" style={{ color: '#8892b8' }}>{approved}/{posts.length} approved</p>
            <div className="w-24 h-1 rounded-full mt-1" style={{ background: '#dde2f0' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#16A34A', transition: 'width 0.4s' }} />
            </div>
          </div>
          <StatusBadge status={campaign.status} small />
          {isAdmin && (
            <button
              onClick={e => { e.stopPropagation(); onGenerate(campaign.id) }}
              disabled={generating}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: NAVY, color: '#fff' }}
            >
              {generating ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              Generate
            </button>
          )}
        </div>
      </button>

      {/* Posts table */}
      {open && (
        <div>
          {posts.length === 0 && (
            <p className="text-xs text-center py-6" style={{ color: '#8892b8' }}>No posts in this campaign yet</p>
          )}
          {posts.map(post => (
            <PostRow key={post.id} post={post} isAdmin={isAdmin} onClick={() => onPostClick(post)} />
          ))}
        </div>
      )}
    </div>
  )
}

function PostRow({ post, isAdmin, onClick }: { post: ContentItem; isAdmin: boolean; onClick: () => void }) {
  const isCancelled = post.status === 'cancelled'
  const borderLeft = rowBorder(post.status)

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-5 py-2.5 cursor-pointer"
      style={{
        borderBottom: '1px solid #f4f6fb',
        borderLeft: `3px solid ${borderLeft}`,
        opacity: isCancelled ? 0.5 : 1,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f8f9ff')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Thumb */}
      <div className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
        style={{ background: '#f4f6fb', border: '1px solid #dde2f0' }}>
        {post.feed_post_url
          ? <img src={post.feed_post_url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          : <ImageIcon size={14} style={{ color: '#dde2f0' }} />
        }
      </div>

      {/* Date */}
      <span className="text-xs w-20 flex-shrink-0" style={{ color: '#8892b8' }}>
        {post.scheduled_date || '—'}
      </span>

      {/* Product */}
      <span
        className={`flex-1 text-sm min-w-0 truncate ${isCancelled ? 'line-through' : ''}`}
        style={{ color: '#1a1f3a' }}
      >
        {post.product_name}
      </span>

      {/* Channel */}
      <div className="flex-shrink-0">
        <ChannelBadge channel={post.channel} />
      </div>

      {/* Status */}
      <div className="flex-shrink-0 w-36 text-right">
        <StatusBadge status={post.status} small />
      </div>
    </div>
  )
}

// ── Calendar view (embedded, simplified) ─────────────────────────────────────
function CalendarView({ posts, onPostClick }: { posts: ContentItem[]; onPostClick: (p: ContentItem) => void }) {
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7 // Mon=0

  const byDate: Record<string, ContentItem[]> = {}
  posts.forEach(p => {
    if (!p.scheduled_date) return
    const key = p.scheduled_date.slice(0, 7)
    const mStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
    if (key !== mStr) return
    byDate[p.scheduled_date] = byDate[p.scheduled_date] || []
    byDate[p.scheduled_date].push(p)
  })

  const monthName = MONTHS[viewMonth]
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const selectedKey = selectedDay
    ? `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, '0')}-${String(selectedDay.getDate()).padStart(2, '0')}`
    : null
  const dayPosts = selectedKey ? (byDate[selectedKey] || []) : []

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1) } else setViewMonth(v => v - 1) }}
            className="px-2 py-1 rounded text-xs" style={{ border: '1px solid #dde2f0', color: '#4a5280' }}>‹</button>
          <span className="text-sm font-semibold" style={{ color: '#1a1f3a' }}>{monthName} {viewYear}</span>
          <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1) } else setViewMonth(v => v + 1) }}
            className="px-2 py-1 rounded text-xs" style={{ border: '1px solid #dde2f0', color: '#4a5280' }}>›</button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DOW.map(d => (
            <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: '#8892b8' }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px" style={{ background: '#dde2f0', border: '1px solid #dde2f0', borderRadius: 12, overflow: 'hidden' }}>
          {Array(firstDow).fill(null).map((_, i) => <div key={`e${i}`} style={{ background: '#f4f6fb' }} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayItems = byDate[dateKey] || []
            const isSelected = selectedDay?.getDate() === day && selectedDay?.getMonth() === viewMonth
            const isToday = new Date().toDateString() === new Date(viewYear, viewMonth, day).toDateString()
            return (
              <div
                key={day}
                onClick={() => setSelectedDay(dayItems.length ? new Date(viewYear, viewMonth, day) : null)}
                className="p-1.5 min-h-[72px] cursor-pointer"
                style={{
                  background: isSelected ? '#f0f3ff' : '#fff',
                  borderTop: isToday ? `2px solid ${NAVY}` : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: isToday ? NAVY : '#1a1f3a' }}>{day}</span>
                  {dayItems.length > 2 && <span className="text-xs" style={{ color: '#8892b8' }}>+{dayItems.length - 2}</span>}
                </div>
                <div className="space-y-0.5">
                  {dayItems.slice(0, 2).map(p => (
                    <div
                      key={p.id}
                      onClick={e => { e.stopPropagation(); onPostClick(p) }}
                      className="text-xs px-1.5 py-0.5 rounded truncate"
                      style={{ background: '#f0f3ff', color: NAVY, fontSize: 10 }}
                    >
                      {p.product_name}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Day panel */}
      {selectedDay && dayPosts.length > 0 && (
        <div className="w-64 flex-shrink-0 rounded-xl overflow-hidden" style={{ border: '1px solid #dde2f0', background: '#fff' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #dde2f0', background: '#f8f9ff' }}>
            <p className="text-xs font-semibold" style={{ color: '#1a1f3a' }}>
              {selectedDay.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <p className="text-xs" style={{ color: '#8892b8' }}>{dayPosts.length} post{dayPosts.length > 1 ? 's' : ''}</p>
          </div>
          <div className="divide-y" style={{ borderColor: '#f4f6fb' }}>
            {dayPosts.map(p => (
              <div key={p.id} onClick={() => onPostClick(p)}
                className="px-4 py-2.5 cursor-pointer"
                onMouseEnter={e => (e.currentTarget.style.background = '#f8f9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <p className="text-xs font-medium truncate" style={{ color: '#1a1f3a' }}>{p.product_name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ChannelBadge channel={p.channel} />
                  <StatusBadge status={p.status} small />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── New campaign modal ─────────────────────────────────────────────────────────
interface NewPost { product_name: string; channel: string; scheduled_date: string; post_type: string; visual_direction: string }

function NewCampaignModal({ brands, onClose, onCreated }: {
  brands: Brand[]
  onClose: () => void
  onCreated: (campaign: Campaign) => void
}) {
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    brand_key: brands[0]?.key || 'mbc',
    name: '',
    theme: '',
    visual_direction: '',
    month_label: '',
    year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
    notes: '',
  })
  const [posts, setPosts] = useState<NewPost[]>([])

  const addPost = () => setPosts(p => [...p, { product_name: '', channel: 'instagram_post', scheduled_date: '', post_type: 'static', visual_direction: '' }])
  const updatePost = (i: number, field: keyof NewPost, val: string) =>
    setPosts(p => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  const removePost = (i: number) => setPosts(p => p.filter((_, idx) => idx !== i))

  const save = async (generate: boolean) => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const campaign = await api.post<Campaign>('/campaigns', {
        ...form,
        year: Number(form.year),
        status: 'active',
      })
      // Create content items linked to campaign
      for (const p of posts) {
        if (!p.product_name.trim()) continue
        await api.post('/content', {
          campaign_id: campaign.id,
          brand_key: campaign.brand_key,
          product_name: p.product_name,
          campaign: campaign.name,
          channel: p.channel,
          post_type: p.post_type,
          scheduled_date: p.scheduled_date || null,
          visual_direction: p.visual_direction || form.visual_direction || null,
          status: 'pending',
        }).catch(() => {})
      }
      if (generate) {
        await api.post(`/campaigns/${campaign.id}/generate`).catch(() => {})
      }
      toast(generate ? 'Campaign created — pipeline started!' : 'Campaign saved as draft')
      onCreated(campaign)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create campaign', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,26,80,0.4)' }}>
      <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #dde2f0' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#1a1f3a' }}>New Campaign</h2>
            <p className="text-xs mt-0.5" style={{ color: '#8892b8' }}>Step {step} of 3</p>
          </div>
          <button onClick={onClose}><X size={18} style={{ color: '#8892b8' }} /></button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-3 flex gap-1 flex-shrink-0">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex-1 h-1 rounded-full" style={{ background: s <= step ? NAVY : '#dde2f0' }} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Brand</label>
                  <select value={form.brand_key} onChange={e => setForm(f => ({ ...f, brand_key: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}>
                    {brands.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Campaign name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
                    placeholder="e.g. Hartford Roper Launch" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Theme / creative direction</label>
                <textarea rows={3} value={form.theme} onChange={e => setForm(f => ({ ...f, theme: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
                  placeholder="What's the core message? What feeling should content evoke?" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Visual direction</label>
                <textarea rows={3} value={form.visual_direction} onChange={e => setForm(f => ({ ...f, visual_direction: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
                  placeholder="Describe the look, feel, scenes, styling" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Month</label>
                  <select value={form.month_label} onChange={e => setForm(f => ({ ...f, month_label: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}>
                    <option value="">Select…</option>
                    {MONTHS.map(m => <option key={m} value={`${m} ${form.year}`}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Start date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>End date</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium" style={{ color: '#1a1f3a' }}>Posts in this campaign</p>
                <button onClick={addPost}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: NAVY, color: '#fff' }}>
                  <Plus size={12} /> Add post
                </button>
              </div>
              {posts.length === 0 && (
                <div className="text-center py-8 text-sm" style={{ color: '#8892b8' }}>
                  No posts yet — click "Add post" to start
                </div>
              )}
              {posts.map((p, i) => (
                <div key={i} className="rounded-xl p-4 space-y-3" style={{ border: '1px solid #dde2f0', background: '#f8f9ff' }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Product / post name</label>
                      <input value={p.product_name} onChange={e => updatePost(i, 'product_name', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Channel</label>
                      <select value={p.channel} onChange={e => updatePost(i, 'channel', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}>
                        <option value="instagram_post">Instagram Post</option>
                        <option value="instagram_stories">Instagram Stories</option>
                        <option value="tiktok">TikTok</option>
                        <option value="email">Email</option>
                        <option value="facebook">Facebook</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Date</label>
                      <input type="date" value={p.scheduled_date} onChange={e => updatePost(i, 'scheduled_date', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Post type</label>
                      <select value={p.post_type} onChange={e => updatePost(i, 'post_type', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}>
                        <option value="static">Static</option>
                        <option value="reel">Reel</option>
                        <option value="carousel">Carousel</option>
                        <option value="email">Email</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Visual direction (optional)</label>
                      <input value={p.visual_direction} onChange={e => updatePost(i, 'visual_direction', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
                        placeholder="Override campaign-level direction…" />
                    </div>
                    <button onClick={() => removePost(i)} className="p-1.5 rounded-lg" style={{ color: '#b91c1c', background: '#fff4f3' }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl p-4" style={{ background: '#f8f9ff', border: '1px solid #dde2f0' }}>
                <p className="text-sm font-semibold mb-2" style={{ color: '#1a1f3a' }}>{form.name}</p>
                {form.theme && <p className="text-xs mb-1" style={{ color: '#4a5280' }}><strong>Theme:</strong> {form.theme}</p>}
                {form.month_label && <p className="text-xs mb-1" style={{ color: '#4a5280' }}><strong>Month:</strong> {form.month_label}</p>}
                {form.start_date && <p className="text-xs mb-1" style={{ color: '#4a5280' }}><strong>Dates:</strong> {form.start_date} → {form.end_date}</p>}
                <p className="text-xs mt-2" style={{ color: '#8892b8' }}>{posts.filter(p => p.product_name.trim()).length} posts to create</p>
              </div>
              {posts.filter(p => p.product_name.trim()).map((p, i) => (
                <div key={i} className="flex items-center gap-3 text-sm" style={{ color: '#1a1f3a' }}>
                  <Check size={14} style={{ color: '#16A34A' }} />
                  <span>{p.product_name}</span>
                  <ChannelBadge channel={p.channel} />
                  {p.scheduled_date && <span className="text-xs" style={{ color: '#8892b8' }}>{p.scheduled_date}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #dde2f0' }}>
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="text-sm px-4 py-2 rounded-lg" style={{ border: '1px solid #dde2f0', color: '#4a5280' }}>
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          <div className="flex gap-2">
            {step < 3 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.name.trim()}
                className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
                style={{ background: NAVY, color: '#fff' }}>
                Next
              </button>
            ) : (
              <>
                <button onClick={() => save(false)} disabled={saving}
                  className="text-sm px-4 py-2 rounded-lg disabled:opacity-40"
                  style={{ border: '1px solid #dde2f0', color: '#4a5280' }}>
                  Save as draft
                </button>
                <button onClick={() => save(true)} disabled={saving}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
                  style={{ background: NAVY, color: '#fff' }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Save and generate
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlanPage() {
  const { user } = useAuth()
  const [view, setView] = useState<'plan' | 'calendar'>('plan')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [posts, setPosts] = useState<ContentItem[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState('mbc')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [drawerPost, setDrawerPost] = useState<ContentItem | null>(null)
  const [showNewCampaign, setShowNewCampaign] = useState(false)
  const [generatingId, setGeneratingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    api.get<Brand[]>('/brands').then(setBrands)
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ brand: selectedBrand })
    if (selectedMonth) params.set('month', selectedMonth)
    Promise.all([
      api.get<Campaign[]>(`/campaigns?${params}`),
      api.get<ContentItem[]>(`/content?${params}`),
    ]).then(([c, p]) => {
      setCampaigns(c)
      setPosts(p)
    }).finally(() => setLoading(false))
  }, [selectedBrand, selectedMonth])

  const postsByCampaign = useMemo(() => {
    const map: Record<number, ContentItem[]> = {}
    posts.forEach(p => {
      if (p.campaign_id) {
        map[p.campaign_id] = map[p.campaign_id] || []
        map[p.campaign_id].push(p)
      }
    })
    return map
  }, [posts])

  const unplanned = useMemo(() => posts.filter(p => !p.campaign_id), [posts])

  const handlePostUpdate = (updated: ContentItem) => {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
    setDrawerPost(updated)
  }

  const handleGenerate = async (campaignId: number) => {
    setGeneratingId(campaignId)
    try {
      await api.post(`/campaigns/${campaignId}/generate`)
    } finally {
      setTimeout(() => setGeneratingId(null), 2000)
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-8 py-4 flex-shrink-0" style={{ background: '#fff', borderBottom: '1px solid #dde2f0' }}>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold" style={{ color: '#1a1f3a' }}>Campaign Plan</h1>
          </div>

          {/* Filters */}
          <select value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}>
            {brands.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
          </select>

          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}>
            <option value="">All months</option>
            {YEARS.flatMap(y => MONTHS.map(m => `${m} ${y}`)).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #dde2f0' }}>
            <button onClick={() => setView('plan')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
              style={{ background: view === 'plan' ? NAVY : '#fff', color: view === 'plan' ? '#fff' : '#4a5280' }}>
              <List size={13} /> Plan
            </button>
            <button onClick={() => setView('calendar')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
              style={{ background: view === 'calendar' ? NAVY : '#fff', color: view === 'calendar' ? '#fff' : '#4a5280' }}>
              <Calendar size={13} /> Calendar
            </button>
          </div>

          {isAdmin && (
            <button onClick={() => setShowNewCampaign(true)}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg"
              style={{ background: NAVY, color: '#fff' }}>
              <Plus size={14} /> New campaign
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin" style={{ color: '#8892b8' }} />
            </div>
          ) : view === 'plan' ? (
            <>
              {campaigns.length === 0 && unplanned.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-sm" style={{ color: '#8892b8' }}>No campaigns yet.</p>
                  {isAdmin && (
                    <button onClick={() => setShowNewCampaign(true)}
                      className="mt-3 flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg mx-auto"
                      style={{ background: NAVY, color: '#fff' }}>
                      <Plus size={14} /> Create first campaign
                    </button>
                  )}
                </div>
              )}
              {campaigns.map(c => (
                <CampaignSection
                  key={c.id}
                  campaign={c}
                  posts={postsByCampaign[c.id] || []}
                  isAdmin={isAdmin}
                  onPostClick={setDrawerPost}
                  onGenerate={handleGenerate}
                  generating={generatingId === c.id}
                />
              ))}

              {unplanned.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#8892b8' }}>Unplanned posts</p>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #dde2f0', background: '#fff' }}>
                    {unplanned.map(p => (
                      <PostRow key={p.id} post={p} isAdmin={isAdmin} onClick={() => setDrawerPost(p)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <CalendarView posts={posts} onPostClick={setDrawerPost} />
          )}
        </div>
      </main>

      {/* Post drawer */}
      {user && (
        <PostDrawer
          item={drawerPost}
          currentUser={user}
          onClose={() => setDrawerPost(null)}
          onUpdate={handlePostUpdate}
        />
      )}

      {/* New campaign modal */}
      {showNewCampaign && (
        <NewCampaignModal
          brands={brands}
          onClose={() => setShowNewCampaign(false)}
          onCreated={campaign => {
            setCampaigns(prev => [campaign, ...prev])
            setShowNewCampaign(false)
          }}
        />
      )}
    </div>
  )
}
