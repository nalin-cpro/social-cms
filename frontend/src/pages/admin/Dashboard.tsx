import { useEffect, useState, useRef } from 'react'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { ContentItem, Brand, Campaign } from '../../types'
import StatusBadge from '../../components/StatusBadge'
import { LayoutGrid, Clock, CheckCircle, Users, Play, Loader2, X, FlaskConical } from 'lucide-react'

const STAT_ACCENT: Record<string, string> = {
  review:   '#D97706',
  client:   '#7c3aed',
  approved: '#16A34A',
  total:    '#1a2d82',
}

interface PipelineRun {
  id: number
  brand_key: string
  month_label: string | null
  status: string
  posts_processed: number
  posts_ready: number
  posts_errored: number
  current_post: string | null
  error_log: string | null
  started_at: string
  completed_at: string | null
}


export default function AdminDashboard() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showPipelineModal, setShowPipelineModal] = useState(false)

  // Modal form state
  const [brand, setBrand] = useState('mbc')
  const [filterMode, setFilterMode] = useState<'campaign' | 'date'>('campaign')
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [mode, setMode] = useState<'all' | 'copy_only' | 'image_only'>('all')
  const [limit, setLimit] = useState(3)
  const [testMode, setTestMode] = useState(false)

  // Pipeline run tracking
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null)
  const [starting, setStarting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api.get<ContentItem[]>('/content').then(setItems)
    api.get<Brand[]>('/brands').then(setBrands)
  }, [])

  useEffect(() => {
    api.get<Campaign[]>(`/campaigns?brand=${brand}`).then(cs => {
      setCampaigns(cs)
      setSelectedCampaignId(cs[0]?.id ?? '')
    })
  }, [brand])

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const counts = {
    review:   items.filter(i => i.status === 'ready_for_internal_review').length,
    client:   items.filter(i => i.status === 'ready_for_approval').length,
    approved: items.filter(i => i.status === 'approved' || i.status === 'published').length,
    total:    items.length,
  }

  const startPolling = (runId: number) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const run = await api.get<PipelineRun>(`/pipeline/status/${runId}`)
        setActiveRun(run)
        if (run.status !== 'running') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          // Refresh content items
          api.get<ContentItem[]>('/content').then(setItems)
        }
      } catch { /* ignore */ }
    }, 3000)
  }

  const runPipeline = async () => {
    setStarting(true)
    setActiveRun(null)
    try {
      const payload: Record<string, unknown> = {
        brand_key: brand,
        mode,
        limit: Math.min(Math.max(1, limit), 25),
        test_mode: testMode,
      }
      if (filterMode === 'campaign' && selectedCampaignId !== '') {
        payload.campaign_id = selectedCampaignId
      } else {
        payload.start_date = startDate || undefined
        payload.end_date = endDate || undefined
      }
      const run = await api.post<PipelineRun>('/pipeline/campaign/run', payload)
      setActiveRun(run)
      startPolling(run.id)
    } catch (e) {
      setActiveRun({ id: 0, brand_key: brand, month_label: null, status: 'failed',
        posts_processed: 0, posts_ready: 0, posts_errored: 0, current_post: null,
        error_log: e instanceof Error ? e.message : 'Failed to start', started_at: '', completed_at: null })
    } finally {
      setStarting(false)
    }
  }

  const closeModal = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    setShowPipelineModal(false)
    setActiveRun(null)
  }

  const statCards = [
    { label: 'Awaiting review', value: counts.review,   icon: Clock,        accentKey: 'review' },
    { label: 'With client',     value: counts.client,   icon: Users,        accentKey: 'client' },
    { label: 'Approved',        value: counts.approved, icon: CheckCircle,  accentKey: 'approved' },
    { label: 'Total this month',value: counts.total,    icon: LayoutGrid,   accentKey: 'total' },
  ]

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#1a1f3a' }}>Dashboard</h1>
            <p className="text-sm mt-0.5" style={{ color: '#4a5280' }}>Content pipeline overview</p>
          </div>
          <button
            onClick={() => setShowPipelineModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-opacity"
            style={{ background: '#1a2d82', color: '#fff' }}
          >
            <Play size={14} />
            Run Pipeline
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {statCards.map(({ label, value, icon: Icon, accentKey }) => (
            <div
              key={label}
              className="rounded-xl p-5 flex flex-col"
              style={{
                background: '#fff',
                border: '1px solid #dde2f0',
                borderLeft: `3px solid ${STAT_ACCENT[accentKey]}`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8892b8' }}>{label}</p>
                <Icon size={15} style={{ color: STAT_ACCENT[accentKey] }} />
              </div>
              <p className="font-bold" style={{ fontSize: 30, color: '#1a1f3a' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Brand progress */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {brands.map(b => {
            const brandItems = items.filter(i => i.brand_key === b.key)
            const approved = brandItems.filter(i => i.status === 'approved').length
            const pct = brandItems.length ? Math.round((approved / brandItems.length) * 100) : 0
            return (
              <div key={b.key} className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium" style={{ color: '#1a1f3a' }}>{b.name}</p>
                  <span className="text-xs" style={{ color: '#8892b8' }}>{approved}/{brandItems.length} approved</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#dde2f0' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#1a2d82' }} />
                </div>
                <p className="text-xs mt-2" style={{ color: '#8892b8' }}>{pct}% approval rate</p>
              </div>
            )
          })}
        </div>

        {/* Recent activity */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #dde2f0' }}>
            <p className="text-sm font-semibold" style={{ color: '#1a1f3a' }}>Recent Content</p>
          </div>
          <div>
            {items.slice(0, 10).map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: idx < Math.min(items.length, 10) - 1 ? '1px solid #dde2f0' : 'none' }}
              >
                <div>
                  <p className="text-sm" style={{ color: '#1a1f3a' }}>{item.product_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8892b8' }}>
                    {item.brand_key.toUpperCase()} · {item.channel} · {item.scheduled_date}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
            {items.length === 0 && (
              <div className="px-5 py-8 text-sm text-center" style={{ color: '#8892b8' }}>No content items yet</div>
            )}
          </div>
        </div>
      </main>

      {/* Pipeline modal */}
      {showPipelineModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(15,26,80,0.4)' }}>
          <div className="rounded-xl w-full max-w-lg" style={{ background: '#fff', border: '1px solid #dde2f0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #dde2f0' }}>
              <h2 className="text-base font-semibold" style={{ color: '#1a1f3a' }}>Run Pipeline</h2>
              <button onClick={closeModal}><X size={18} style={{ color: '#8892b8' }} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Brand */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>Brand</label>
                <select value={brand} onChange={e => setBrand(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}>
                  {brands.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
                </select>
              </div>

              {/* Filter mode tabs */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>Filter by</label>
                <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: '#e8ebf5' }}>
                  {(['campaign', 'date'] as const).map(m => (
                    <button key={m} onClick={() => setFilterMode(m)}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                      style={filterMode === m
                        ? { background: '#fff', color: '#1a2d82', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                        : { color: '#4a5280', background: 'transparent' }}>
                      {m === 'campaign' ? 'By campaign' : 'By date range'}
                    </button>
                  ))}
                </div>
              </div>

              {filterMode === 'campaign' ? (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>Campaign</label>
                  <select value={selectedCampaignId} onChange={e => setSelectedCampaignId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}>
                    {campaigns.length === 0
                      ? <option value="">No campaigns for this brand</option>
                      : campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                    }
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>Start date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>End date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
                  </div>
                </div>
              )}

              {/* Generation mode */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>Generate</label>
                <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#e8ebf5' }}>
                  {([['all', 'Copy + Images'], ['copy_only', 'Copy only'], ['image_only', 'Images only']] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setMode(v)}
                      className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
                      style={mode === v
                        ? { background: '#fff', color: '#1a2d82', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                        : { color: '#4a5280', background: 'transparent' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Post limit */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>
                  Max posts to generate <span style={{ color: '#8892b8', fontWeight: 400 }}>(1–25)</span>
                </label>
                <input type="number" min={1} max={25} value={limit} onChange={e => setLimit(Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
              </div>

              {/* Test mode */}
              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input type="checkbox" checked={testMode} onChange={e => setTestMode(e.target.checked)} className="rounded" />
                <span className="flex items-center gap-1.5 text-sm" style={{ color: '#1a1f3a' }}>
                  <FlaskConical size={13} style={{ color: '#7c3aed' }} />
                  Test mode — use placeholder images, skip fal.ai credits
                </span>
              </label>

              {/* Progress section */}
              {activeRun && (
                <div className="rounded-xl p-4 space-y-2" style={{
                  background: activeRun.status === 'failed' ? '#fff4f3' : activeRun.status === 'complete' ? '#f0fdf4' : '#f0f3ff',
                  border: `1px solid ${activeRun.status === 'failed' ? '#fca5a5' : activeRun.status === 'complete' ? '#bbf7d0' : '#c7d2fe'}`,
                }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold" style={{ color: '#1a1f3a' }}>
                      {activeRun.status === 'running' ? 'Running…' : activeRun.status === 'complete' ? 'Complete' : 'Failed'}
                    </p>
                    {activeRun.status === 'running' && <Loader2 size={13} className="animate-spin" style={{ color: '#1a2d82' }} />}
                  </div>
                  {activeRun.current_post && activeRun.status === 'running' && (
                    <p className="text-xs" style={{ color: '#4a5280' }}>
                      Generating {activeRun.current_post}… ({activeRun.posts_processed}/{activeRun.posts_ready + activeRun.posts_errored + 1})
                    </p>
                  )}
                  {activeRun.posts_processed > 0 && (
                    <p className="text-xs" style={{ color: '#4a5280' }}>
                      {activeRun.posts_ready} ready · {activeRun.posts_errored} errors · {activeRun.posts_processed} processed
                    </p>
                  )}
                  {activeRun.status === 'complete' && (
                    <p className="text-xs font-medium" style={{ color: '#15803d' }}>
                      {activeRun.posts_ready} post{activeRun.posts_ready !== 1 ? 's' : ''} ready for review
                    </p>
                  )}
                  {activeRun.error_log && activeRun.status !== 'complete' && (
                    <p className="text-xs font-mono" style={{ color: '#b91c1c' }}>{activeRun.error_log}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-5">
              <button onClick={closeModal}
                className="flex-1 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ border: '1px solid #dde2f0', color: '#1a1f3a', background: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                {activeRun?.status && activeRun.status !== 'running' ? 'Close' : 'Cancel'}
              </button>
              <button onClick={runPipeline}
                disabled={starting || activeRun?.status === 'running'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                style={{ background: '#1a2d82', color: '#fff' }}>
                {starting || activeRun?.status === 'running'
                  ? <><Loader2 size={14} className="animate-spin" /> Running…</>
                  : <><Play size={14} /> Run</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
