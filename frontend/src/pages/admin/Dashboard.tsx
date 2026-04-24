import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { ContentItem, Brand } from '../../types'
import StatusBadge from '../../components/StatusBadge'
import { LayoutGrid, Clock, CheckCircle, Users, Play, Loader2, X } from 'lucide-react'

const STAT_ACCENT: Record<string, string> = {
  review:   '#D97706',
  client:   '#7c3aed',
  approved: '#16A34A',
  total:    '#1a2d82',
}

export default function AdminDashboard() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [showPipelineModal, setShowPipelineModal] = useState(false)
  const [pipelineBrand, setPipelineBrand] = useState('mbc')
  const [pipelineMonth, setPipelineMonth] = useState('April 2026')
  const [dryRun, setDryRun] = useState(true)
  const [pipelineRunning, setPipelineRunning] = useState(false)
  const [pipelineMsg, setPipelineMsg] = useState('')

  useEffect(() => {
    api.get<ContentItem[]>('/content').then(setItems)
    api.get<Brand[]>('/brands').then(setBrands)
  }, [])

  const counts = {
    review:   items.filter(i => i.status === 'ready_for_internal_review').length,
    client:   items.filter(i => i.status === 'ready_for_approval').length,
    approved: items.filter(i => i.status === 'approved' || i.status === 'published').length,
    total:    items.length,
  }

  const runPipeline = async () => {
    setPipelineRunning(true)
    setPipelineMsg('')
    try {
      await api.post('/pipeline/run', { brand_key: pipelineBrand, month_label: pipelineMonth, dry_run: dryRun })
      setPipelineMsg('Pipeline started successfully.')
    } catch (e) {
      setPipelineMsg(e instanceof Error ? e.message : 'Failed to start pipeline')
    } finally {
      setPipelineRunning(false)
    }
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
          <div className="rounded-xl w-full max-w-md p-6" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: '#1a1f3a' }}>Run Pipeline</h2>
              <button onClick={() => { setShowPipelineModal(false); setPipelineMsg('') }}>
                <X size={18} style={{ color: '#8892b8' }} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>Brand</label>
                <select
                  value={pipelineBrand}
                  onChange={e => setPipelineBrand(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
                >
                  {brands.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>Month</label>
                <input
                  value={pipelineMonth}
                  onChange={e => setPipelineMonth(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="rounded" />
                <span className="text-sm" style={{ color: '#1a1f3a' }}>Dry run (skip email send)</span>
              </label>
              {pipelineMsg && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#f4f6fb', color: '#4a5280' }}>
                  {pipelineMsg}
                </p>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowPipelineModal(false); setPipelineMsg('') }}
                className="flex-1 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ border: '1px solid #dde2f0', color: '#1a1f3a', background: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                Cancel
              </button>
              <button
                onClick={runPipeline}
                disabled={pipelineRunning}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                style={{ background: '#1a2d82', color: '#fff' }}
              >
                {pipelineRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {pipelineRunning ? 'Starting…' : 'Run'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
