import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { ContentItem } from '../../types'
import ContentCard from '../../components/ContentCard'
import { Filter } from 'lucide-react'

const STATUSES = ['', 'pending', 'ready_for_approval', 'changes_requested', 'approved', 'error']
const CHANNELS = ['', 'instagram_post', 'instagram_stories', 'email', 'sms']

export default function AdminContentQueue() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (channel) params.set('channel', channel)
    api.get<ContentItem[]>(`/content?${params}`).then(setItems)
  }, [status, channel])

  const attention = items.filter(i => i.status === 'changes_requested')
  const pending   = items.filter(i => ['pending', 'ready_for_approval', 'generating'].includes(i.status))
  const approved  = items.filter(i => i.status === 'approved')
  const rest      = items.filter(i => !['changes_requested', 'pending', 'ready_for_approval', 'generating', 'approved'].includes(i.status))

  const grouped = !status && !channel
  const allItems = grouped ? [...attention, ...pending, ...approved, ...rest] : items

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#1a1f3a' }}>Content Queue</h1>
            <p className="text-sm mt-0.5" style={{ color: '#4a5280' }}>{items.length} items</p>
          </div>
          <div className="flex items-center gap-3">
            <Filter size={15} style={{ color: '#8892b8' }} />
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid #dde2f0', background: '#fff', color: '#1a1f3a' }}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
            </select>
            <select
              value={channel}
              onChange={e => setChannel(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid #dde2f0', background: '#fff', color: '#1a1f3a' }}
            >
              {CHANNELS.map(c => <option key={c} value={c}>{c || 'All channels'}</option>)}
            </select>
          </div>
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid #dde2f0' }}
        >
          {/* Column headers */}
          <div
            className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
            style={{ background: '#f4f6fb', borderBottom: '1px solid #dde2f0', color: '#8892b8' }}
          >
            <span>Product / Channel</span>
            <span>Status</span>
          </div>

          {grouped ? (
            <>
              {attention.length > 0 && (
                <>
                  <div
                    className="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                    style={{ background: '#fff4f3', border: '1px solid #f5c2be', borderLeft: 'none', borderRight: 'none', color: '#b91c1c' }}
                  >
                    Needs Attention — {attention.length}
                  </div>
                  <div className="divide-y" style={{ borderColor: '#dde2f0' }}>
                    {attention.map(item => (
                      <div key={item.id} className="px-4 py-2">
                        <ContentCard item={item} basePath="/designer/content" showComment />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {pending.length > 0 && (
                <>
                  <div
                    className="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                    style={{ background: '#f4f6fb', borderTop: '1px solid #dde2f0', borderBottom: '1px solid #dde2f0', color: '#4a5280' }}
                  >
                    Pending — {pending.length}
                  </div>
                  <div className="divide-y" style={{ borderColor: '#dde2f0' }}>
                    {pending.map(item => (
                      <div key={item.id} className="px-4 py-2">
                        <ContentCard item={item} basePath="/designer/content" />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {approved.length > 0 && (
                <>
                  <div
                    className="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                    style={{ background: '#f4f6fb', borderTop: '1px solid #dde2f0', borderBottom: '1px solid #dde2f0', color: '#4a5280' }}
                  >
                    Approved — {approved.length}
                  </div>
                  <div className="divide-y opacity-70" style={{ borderColor: '#dde2f0' }}>
                    {approved.map(item => (
                      <div key={item.id} className="px-4 py-2">
                        <ContentCard item={item} basePath="/designer/content" />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {rest.length > 0 && (
                <div className="divide-y" style={{ borderColor: '#dde2f0', borderTop: '1px solid #dde2f0' }}>
                  {rest.map(item => (
                    <div key={item.id} className="px-4 py-2">
                      <ContentCard item={item} basePath="/designer/content" />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="divide-y" style={{ borderColor: '#dde2f0' }}>
              {allItems.map(item => (
                <div key={item.id} className="px-4 py-2">
                  <ContentCard item={item} basePath="/designer/content" />
                </div>
              ))}
            </div>
          )}

          {items.length === 0 && (
            <div className="py-16 text-sm text-center" style={{ color: '#8892b8' }}>
              No content items match your filters
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
