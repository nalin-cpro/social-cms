import { useEffect, useState, useMemo } from 'react'
import Sidebar from '../../components/Sidebar'
import StatusBadge from '../../components/StatusBadge'
import { api } from '../../api/client'
import { ContentItem, Brand } from '../../types'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'

// ── Static holidays for 2026 ──────────────────────────────────────────────────
const HOLIDAYS: Record<string, string> = {
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'MLK Day',
  '2026-02-16': "Presidents' Day",
  '2026-04-05': 'Easter Sunday',
  '2026-05-10': "Mother's Day",
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth',
  '2026-07-04': 'Independence Day',
  '2026-09-07': 'Labor Day',
  '2026-11-11': "Veterans' Day",
  '2026-11-26': 'Thanksgiving',
  '2026-12-25': 'Christmas',
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const CHANNEL_DOT: Record<string, string> = {
  instagram_post:    '#9333ea',
  instagram_stories: '#22c55e',
  tiktok:            '#ef4444',
  email:             '#1a2d82',
  sms:               '#f5b800',
}
const CHANNEL_LABEL: Record<string, string> = {
  instagram_post:    'Instagram',
  instagram_stories: 'Stories',
  tiktok:            'TikTok',
  email:             'Email',
  sms:               'SMS',
}

const STATUS_LABEL: Record<string, string> = {
  pending:            'Pending',
  ready_for_approval: 'In Review',
  changes_requested:  'Needs Revision',
  approved:           'Approved',
  error:              'Error',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function monthDays(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function calendarGrid(year: number, month: number): (Date | null)[] {
  const days = monthDays(year, month)
  // Mon=0 … Sun=6
  const firstDow = (days[0].getDay() + 6) % 7
  const grid: (Date | null)[] = Array(firstDow).fill(null)
  grid.push(...days)
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function weekLabel(d: Date): string {
  const end = new Date(d)
  end.setDate(d.getDate() + 6)
  return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function nextMonthLabel(year: number, month: number): string {
  const nm = month === 11 ? 0 : month + 1
  const ny = month === 11 ? year + 1 : year
  return `${MONTHS[nm]} ${ny}`
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ChannelDot({ channel }: { channel: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: CHANNEL_DOT[channel] ?? '#8892b8' }}
      title={CHANNEL_LABEL[channel] ?? channel}
    />
  )
}

function PostMini({ item }: { item: ContentItem }) {
  const thumb = item.feed_post_url || item.lifestyle_url
  const isFlagged = item.status === 'changes_requested'
  return (
    <div
      className="flex items-center gap-2 p-3 rounded-lg"
      style={{
        background: isFlagged ? '#fff9f8' : '#f4f6fb',
        border: isFlagged ? '1px solid #f5c2be' : '1px solid #dde2f0',
        borderLeft: isFlagged ? '2px solid #DC2626' : undefined,
      }}
    >
      <div
        className="w-10 h-10 rounded flex-shrink-0 overflow-hidden"
        style={{ background: '#e8eeff', border: '1px solid #dde2f0' }}
      >
        {thumb ? (
          <img src={thumb} alt={item.product_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChannelDot channel={item.channel} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: '#1a1f3a' }}>{item.product_name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <ChannelDot channel={item.channel} />
          <span className="text-xs" style={{ color: '#8892b8' }}>{CHANNEL_LABEL[item.channel] ?? item.channel}</span>
        </div>
      </div>
      <StatusBadge status={item.status} />
    </div>
  )
}

// ── Calendar view ─────────────────────────────────────────────────────────────
function CalendarView({
  year, month, items,
  selectedDay, onSelectDay,
}: {
  year: number; month: number; items: ContentItem[]
  selectedDay: string | null; onSelectDay: (d: string | null) => void
}) {
  const grid = calendarGrid(year, month)
  const today = isoToday()
  const byDay = useMemo(() => {
    const m: Record<string, ContentItem[]> = {}
    for (const it of items) {
      if (it.scheduled_date) (m[it.scheduled_date] ??= []).push(it)
    }
    return m
  }, [items])

  const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
      {/* Day header */}
      <div className="grid grid-cols-7">
        {DOW.map(d => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wide"
            style={{ background: '#0f1a50', color: 'rgba(255,255,255,0.5)' }}
          >
            {d}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7" style={{ borderTop: '1px solid #dde2f0' }}>
        {grid.map((day, idx) => {
          if (!day) return (
            <div key={`e${idx}`} style={{ background: '#f4f6fb', borderRight: '1px solid #dde2f0', borderBottom: '1px solid #dde2f0', minHeight: 80 }} />
          )
          const iso = isoDate(day)
          const posts = byDay[iso] ?? []
          const holiday = HOLIDAYS[iso]
          const isToday = iso === today
          const isSelected = iso === selectedDay

          return (
            <div
              key={iso}
              onClick={() => onSelectDay(isSelected ? null : iso)}
              className="p-1.5 cursor-pointer transition-colors"
              style={{
                background: isSelected ? '#e8eeff' : '#fff',
                borderRight: '1px solid #dde2f0',
                borderBottom: '1px solid #dde2f0',
                minHeight: 80,
                outline: isToday ? '2px solid #1a2d82' : 'none',
                outlineOffset: '-2px',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f4f6fb' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff' }}
            >
              <span
                className="inline-flex w-5 h-5 items-center justify-center rounded-full text-xs font-semibold mb-1"
                style={{
                  background: isToday ? '#1a2d82' : 'transparent',
                  color: isToday ? '#fff' : '#4a5280',
                }}
              >
                {day.getDate()}
              </span>

              {holiday && (
                <div
                  className="text-center rounded mb-1 truncate"
                  style={{ background: '#fff8e0', color: '#92400e', fontSize: 8, padding: '1px 3px' }}
                >
                  {holiday}
                </div>
              )}

              {posts.slice(0, 3).map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-1 rounded mb-0.5 truncate"
                  style={{ background: '#e8eeff', padding: '1px 4px' }}
                >
                  <ChannelDot channel={p.channel} />
                  <span style={{ fontSize: 9, color: '#1a2d82', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.product_name}
                  </span>
                </div>
              ))}
              {posts.length > 3 && (
                <span style={{ fontSize: 9, color: '#8892b8' }}>+{posts.length - 3} more</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── List view ─────────────────────────────────────────────────────────────────
function ListView({ year, month, items }: { year: number; month: number; items: ContentItem[] }) {
  const days = monthDays(year, month)
  // Group by ISO week (Mon–Sun)
  const weeks: { weekStart: Date; days: Date[] }[] = []
  let currentWeek: Date[] = []
  for (const d of days) {
    const dow = (d.getDay() + 6) % 7
    if (dow === 0 && currentWeek.length > 0) {
      weeks.push({ weekStart: currentWeek[0], days: currentWeek })
      currentWeek = []
    }
    currentWeek.push(d)
  }
  if (currentWeek.length) weeks.push({ weekStart: currentWeek[0], days: currentWeek })

  const byDay = useMemo(() => {
    const m: Record<string, ContentItem[]> = {}
    for (const it of items) {
      if (it.scheduled_date) (m[it.scheduled_date] ??= []).push(it)
    }
    return m
  }, [items])

  const today = isoToday()

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
      {/* Column header */}
      <div
        className="grid gap-0 text-xs font-semibold uppercase tracking-wide"
        style={{
          gridTemplateColumns: '110px 1fr 1fr 80px 110px 80px',
          background: '#0f1a50',
          color: 'rgba(255,255,255,0.4)',
          padding: '10px 16px',
        }}
      >
        <span>Date</span>
        <span>Product</span>
        <span>Campaign</span>
        <span>Channel</span>
        <span>Status</span>
        <span>Actions</span>
      </div>

      {weeks.map(({ weekStart, days: wdays }) => {
        const weekItems = wdays.flatMap(d => byDay[isoDate(d)] ?? [])
        const approvedCount = weekItems.filter(i => i.status === 'approved').length

        return (
          <div key={isoDate(weekStart)}>
            {/* Week sub-header */}
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ background: '#f4f6fb', borderTop: '1px solid #dde2f0', borderBottom: '1px solid #dde2f0' }}
            >
              <span className="text-xs font-semibold" style={{ color: '#4a5280' }}>{weekLabel(weekStart)}</span>
              {weekItems.length > 0 && (
                <span className="text-xs" style={{ color: '#8892b8' }}>
                  {approvedCount}/{weekItems.length} approved
                </span>
              )}
            </div>

            {wdays.map(d => {
              const iso = isoDate(d)
              const posts = byDay[iso] ?? []
              const holiday = HOLIDAYS[iso]
              const isToday = iso === today

              return (
                <div key={iso}>
                  {posts.length === 0 && !holiday ? null : (
                    <>
                      {posts.map((item, i) => {
                        const isFlagged = item.status === 'changes_requested'
                        return (
                          <div
                            key={item.id}
                            className="grid items-center px-4 py-2.5"
                            style={{
                              gridTemplateColumns: '110px 1fr 1fr 80px 110px 80px',
                              background: isFlagged ? '#fff9f8' : (i % 2 === 0 ? '#fff' : '#f9fafc'),
                              borderBottom: '1px solid #dde2f0',
                              borderLeft: isFlagged ? '2px solid #DC2626' : 'none',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#eef1f8')}
                            onMouseLeave={e => (e.currentTarget.style.background = isFlagged ? '#fff9f8' : (i % 2 === 0 ? '#fff' : '#f9fafc'))}
                          >
                            {/* Date */}
                            <div>
                              {i === 0 && (
                                <span
                                  className="text-xs font-semibold"
                                  style={{ color: isToday ? '#1a2d82' : '#1a1f3a' }}
                                >
                                  {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              {i === 0 && holiday && (
                                <div
                                  className="inline-flex mt-0.5 rounded px-1.5 py-0.5 text-xs"
                                  style={{ background: '#fff8e0', color: '#92400e', fontSize: 10 }}
                                >
                                  {holiday}
                                </div>
                              )}
                            </div>
                            {/* Product */}
                            <span className="text-xs font-medium truncate pr-2" style={{ color: '#1a1f3a' }}>
                              {item.product_name}
                            </span>
                            {/* Campaign */}
                            <span className="text-xs truncate pr-2" style={{ color: '#4a5280' }}>{item.campaign}</span>
                            {/* Channel */}
                            <div className="flex items-center gap-1">
                              <ChannelDot channel={item.channel} />
                              <span className="text-xs" style={{ color: '#4a5280' }}>
                                {CHANNEL_LABEL[item.channel] ?? item.channel}
                              </span>
                            </div>
                            {/* Status */}
                            <StatusBadge status={item.status} />
                            {/* Actions */}
                            <button
                              className="text-xs px-2 py-1 rounded"
                              style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#fff' }}
                            >
                              ···
                            </button>
                          </div>
                        )
                      })}
                      {posts.length === 0 && holiday && (
                        <div
                          className="px-4 py-2 text-xs"
                          style={{ borderBottom: '1px solid #dde2f0', color: '#92400e', background: '#fff8e0' }}
                        >
                          {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} — {holiday}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {items.length === 0 && (
        <div className="py-16 text-sm text-center" style={{ color: '#8892b8' }}>
          No posts scheduled this month
        </div>
      )}
    </div>
  )
}

// ── Day side panel ────────────────────────────────────────────────────────────
function DayPanel({
  date, items, onClose,
}: {
  date: string; items: ContentItem[]; onClose: () => void
}) {
  const d = new Date(date + 'T00:00:00')
  const holiday = HOLIDAYS[date]
  return (
    <div
      className="flex-shrink-0 w-80 rounded-xl flex flex-col"
      style={{ background: '#fff', border: '1px solid #dde2f0' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid #dde2f0' }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: '#1a1f3a' }}>
            {d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {holiday && (
            <span className="text-xs" style={{ color: '#92400e' }}>{holiday}</span>
          )}
        </div>
        <button onClick={onClose}>
          <X size={16} style={{ color: '#8892b8' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: '#8892b8' }}>No posts scheduled</p>
        ) : (
          items.map(item => <PostMini key={item.id} item={item} />)
        )}
      </div>

      <div className="p-3" style={{ borderTop: '1px solid #dde2f0' }}>
        <button
          className="w-full py-2 rounded-lg text-xs font-semibold"
          style={{ background: '#e8eeff', color: '#1a2d82', border: '1px solid #c7d2fe' }}
        >
          + Generate for this day
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminCalendar() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState('mbc')
  const [items, setItems] = useState<ContentItem[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    api.get<Brand[]>('/brands').then(b => {
      setBrands(b)
      if (b.length > 0) setSelectedBrand(b[0].key)
    })
  }, [])

  useEffect(() => {
    api.get<ContentItem[]>(`/content?brand=${selectedBrand}`).then(setItems).catch(() => setItems([]))
  }, [selectedBrand])

  const monthItems = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    return items.filter(it => it.scheduled_date?.startsWith(prefix))
  }, [items, year, month])

  const selectedDayItems = useMemo(() => {
    if (!selectedDay) return []
    return items.filter(it => it.scheduled_date === selectedDay)
  }, [items, selectedDay])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const approvedCount = monthItems.filter(i => i.status === 'approved').length
  const pendingCount  = monthItems.filter(i => ['pending', 'ready_for_approval'].includes(i.status)).length

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#1a1f3a' }}>Campaign Calendar</h1>
            <p className="text-sm mt-0.5" style={{ color: '#4a5280' }}>
              {monthItems.length} posts · {approvedCount} approved · {pendingCount} pending
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Brand selector */}
            <select
              value={selectedBrand}
              onChange={e => setSelectedBrand(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid #dde2f0', background: '#fff', color: '#1a1f3a' }}
            >
              {brands.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
            </select>

            {/* Generate next month */}
            <button
              className="px-3 py-1.5 text-sm font-bold rounded-lg"
              style={{ background: '#f5b800', color: '#1a1f3a' }}
            >
              Generate {nextMonthLabel(year, month)} plan
            </button>

            {/* Add post */}
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg"
              style={{ background: '#1a2d82', color: '#fff' }}
            >
              <Plus size={14} />
              Add post
            </button>
          </div>
        </div>

        {/* Month strip */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          <button onClick={prevMonth} className="p-1 rounded" style={{ color: '#4a5280' }}>
            <ChevronLeft size={16} />
          </button>
          {MONTHS.map((m, idx) => (
            <button
              key={m}
              onClick={() => { setMonth(idx); setSelectedDay(null) }}
              className="px-2.5 py-1 text-xs font-medium rounded-lg transition-colors"
              style={idx === month
                ? { background: '#1a2d82', color: '#fff' }
                : { background: '#fff', color: '#4a5280', border: '1px solid #dde2f0' }
              }
            >
              {m.slice(0, 3)}
            </button>
          ))}
          <button onClick={nextMonth} className="p-1 rounded" style={{ color: '#4a5280' }}>
            <ChevronRight size={16} />
          </button>
          <span className="ml-2 text-sm font-semibold" style={{ color: '#1a1f3a' }}>
            {MONTHS[month]} {year}
          </span>

          {/* View toggle */}
          <div className="ml-auto flex rounded-lg overflow-hidden" style={{ border: '1px solid #dde2f0' }}>
            {(['calendar', 'list'] as const).map(v => (
              <button
                key={v}
                onClick={() => { setView(v); setSelectedDay(null) }}
                className="px-3 py-1.5 text-xs font-medium capitalize"
                style={view === v
                  ? { background: '#1a2d82', color: '#fff' }
                  : { background: '#fff', color: '#4a5280' }
                }
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className={`flex gap-4 items-start ${selectedDay && view === 'calendar' ? '' : ''}`}>
          <div className="flex-1 min-w-0">
            {view === 'calendar' ? (
              <CalendarView
                year={year}
                month={month}
                items={monthItems}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
              />
            ) : (
              <ListView year={year} month={month} items={monthItems} />
            )}
          </div>

          {/* Side panel */}
          {selectedDay && view === 'calendar' && (
            <DayPanel
              date={selectedDay}
              items={selectedDayItems}
              onClose={() => setSelectedDay(null)}
            />
          )}
        </div>
      </main>
    </div>
  )
}
