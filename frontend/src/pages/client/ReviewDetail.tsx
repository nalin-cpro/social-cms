import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { ContentItem } from '../../types'
import ImagePreview from '../../components/ImagePreview'
import CopyPreview from '../../components/CopyPreview'
import StatusBadge from '../../components/StatusBadge'
import ApproveBar from '../../components/ApproveBar'
import { useToast } from '../../contexts/ToastContext'
import { ArrowLeft } from 'lucide-react'

export default function ClientReviewDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [item, setItem] = useState<ContentItem | null>(null)

  useEffect(() => {
    if (id) api.get<ContentItem>(`/content/${id}`).then(setItem)
  }, [id])

  if (!item) return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8 flex items-center justify-center">
        <p className="text-sm" style={{ color: '#8892b8' }}>Loading…</p>
      </main>
    </div>
  )

  const hasImages = item.feed_post_url || item.story_1_url || item.story_2_url || item.lifestyle_url

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm mb-6 transition-colors"
          style={{ color: '#8892b8' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#1a1f3a')}
          onMouseLeave={e => (e.currentTarget.style.color = '#8892b8')}
        >
          <ArrowLeft size={15} />
          Back
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#1a1f3a' }}>{item.product_name}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#4a5280' }}>
              {item.campaign} · {item.channel} · {item.scheduled_date}
            </p>
          </div>
          <StatusBadge status={item.status} />
        </div>

        <div
          className="rounded-xl p-6 mb-6"
          style={{ background: '#fff', border: '1px solid #dde2f0' }}
        >
          <div className="grid grid-cols-2 gap-8">
            {hasImages && (
              <div className="space-y-6">
                <h2 className="text-sm font-semibold" style={{ color: '#1a1f3a' }}>Images</h2>
                {item.feed_post_url && <ImagePreview url={item.feed_post_url} label="Feed Post" aspect="square" />}
                <div className="grid grid-cols-2 gap-4">
                  {item.story_1_url && <ImagePreview url={item.story_1_url} label="Story 1" aspect="story" />}
                  {item.story_2_url && <ImagePreview url={item.story_2_url} label="Story 2" aspect="story" />}
                </div>
                {item.lifestyle_url && <ImagePreview url={item.lifestyle_url} label="Lifestyle" aspect="square" />}
              </div>
            )}

            <div className={hasImages ? '' : 'col-span-2 max-w-2xl'}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: '#1a1f3a' }}>Copy</h2>
              {item.copy_json
                ? <CopyPreview copy={item.copy_json} channel={item.channel} />
                : <p className="text-sm" style={{ color: '#8892b8' }}>No copy available</p>
              }
            </div>
          </div>
        </div>

        {item.status === 'ready_for_approval' && (
          <div
            className="rounded-xl p-6"
            style={{ background: '#fff', border: '1px solid #dde2f0' }}
          >
            <ApproveBar
              item={item}
              onUpdate={setItem}
              onApproved={() => toast('Content approved successfully!')}
            />
          </div>
        )}

        {item.status === 'approved' && (
          <div
            className="rounded-xl px-5 py-4 text-sm font-medium text-center"
            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}
          >
            Approved — this content is ready to publish.
          </div>
        )}

        {item.status === 'changes_requested' && (
          <div
            className="rounded-xl px-5 py-4 text-sm"
            style={{ background: '#fff8e0', border: '1px solid #f3cf78', color: '#92400e' }}
          >
            Your feedback has been passed to the team. We'll be in touch shortly.
          </div>
        )}
      </main>
    </div>
  )
}
