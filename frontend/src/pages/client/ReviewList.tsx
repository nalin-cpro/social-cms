import { useEffect, useState, useMemo } from 'react'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { ContentItem } from '../../types'
import StatusBadge from '../../components/StatusBadge'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ImageOff } from 'lucide-react'

function Thumb({ url, name }: { url: string | null; name: string }) {
  const [err, setErr] = useState(false)
  if (!url || err) {
    return (
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: '#dde2f0' }}
      >
        <ImageOff size={14} style={{ color: '#8892b8' }} />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={name}
      onError={() => setErr(true)}
      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
    />
  )
}

export default function ClientReviewList() {
  const [items, setItems] = useState<ContentItem[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get<ContentItem[]>('/content').then(setItems)
  }, [])

  const byCampaign = useMemo(() => {
    const map = new Map<string, ContentItem[]>()
    for (const item of items) {
      const key = item.campaign || 'General'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return map
  }, [items])

  const pending = items.filter(i => i.status === 'ready_for_approval').length
  const approved = items.filter(i => i.status === 'approved').length

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold" style={{ color: '#1a1f3a' }}>Content for Review</h1>
          <p className="text-sm mt-0.5" style={{ color: '#4a5280' }}>
            {pending} awaiting approval · {approved} approved
          </p>
        </div>

        {items.length === 0 && (
          <div className="rounded-xl flex flex-col items-center justify-center py-20" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
            <p className="text-sm" style={{ color: '#8892b8' }}>No content ready for review</p>
          </div>
        )}

        <div className="space-y-6">
          {[...byCampaign.entries()].map(([campaign, posts]) => (
            <div key={campaign} className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #dde2f0', background: '#f8f9fc' }}>
                <p className="text-sm font-semibold" style={{ color: '#1a1f3a' }}>{campaign}</p>
                <span className="text-xs" style={{ color: '#8892b8' }}>{posts.length} post{posts.length !== 1 ? 's' : ''}</span>
              </div>
              {posts.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/client/review/${item.id}`)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                  style={{
                    borderBottom: idx < posts.length - 1 ? '1px solid #dde2f0' : 'none',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Thumb url={item.feed_post_url} name={item.product_name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#1a1f3a' }}>{item.product_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#8892b8' }}>
                      {item.channel} · {item.scheduled_date ?? 'No date'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={item.status} small />
                    <ChevronRight size={15} style={{ color: '#8892b8' }} />
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
