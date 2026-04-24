import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { CampaignPlan } from '../../types'
import { CalendarDays } from 'lucide-react'

const MONTHS = ['April 2026', 'May 2026', 'June 2026']

export default function AdminCampaignPlan() {
  const [plans, setPlans] = useState<CampaignPlan[]>([])
  const [activeMonth, setActiveMonth] = useState(MONTHS[0])
  const [view, setView] = useState<'list' | 'calendar'>('list')

  useEffect(() => { api.get<CampaignPlan[]>('/campaigns').then(setPlans) }, [])

  const filtered = plans.filter(p => !activeMonth || p.month_label === activeMonth)

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#1a1f3a' }}>Campaign Plans</h1>
            <p className="text-sm mt-0.5" style={{ color: '#4a5280' }}>Monthly content calendar</p>
          </div>
          <button
            className="px-4 py-2 text-sm font-bold rounded-lg"
            style={{ background: '#f5b800', color: '#1a1f3a' }}
          >
            Generate May plan
          </button>
        </div>

        {/* Month pills */}
        <div className="flex items-center gap-2 mb-6">
          {MONTHS.map(m => (
            <button
              key={m}
              onClick={() => setActiveMonth(m)}
              className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
              style={activeMonth === m
                ? { background: '#1a2d82', color: '#fff' }
                : { background: '#fff', color: '#4a5280', border: '1px solid #dde2f0' }
              }
            >
              {m}
            </button>
          ))}

          {/* View toggle */}
          <div className="ml-auto flex rounded-lg overflow-hidden" style={{ border: '1px solid #dde2f0' }}>
            {(['list', 'calendar'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
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

        {/* Plans list */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
          {/* List header */}
          <div
            className="px-5 py-3 text-xs font-semibold uppercase tracking-wide grid grid-cols-[1fr_auto_auto]"
            style={{ background: '#0f1a50', color: 'rgba(255,255,255,0.4)' }}
          >
            <span>Campaign</span>
            <span className="mr-12">Posts</span>
            <span>Created</span>
          </div>

          <div>
            {filtered.map(plan => (
              <div
                key={plan.id}
                className="flex items-center justify-between px-5 py-4 transition-colors"
                style={{ borderBottom: '1px solid #dde2f0' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: '#e8eeff' }}
                  >
                    <CalendarDays size={16} style={{ color: '#1a2d82' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#1a1f3a' }}>
                      {plan.brand_key.toUpperCase()} — {plan.month_label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#8892b8' }}>
                      {(plan.plan_json as unknown[]).length} posts · {plan.status}
                    </p>
                  </div>
                </div>
                <span className="text-xs" style={{ color: '#8892b8' }}>
                  {new Date(plan.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-16 text-sm text-center" style={{ color: '#8892b8' }}>
                No campaign plans for {activeMonth}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
