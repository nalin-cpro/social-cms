import { useNavigate } from 'react-router-dom'
import { ContentItem } from '../types'
import StatusBadge from './StatusBadge'
import { Image, AlertCircle } from 'lucide-react'

interface Props {
  item: ContentItem
  basePath: string
  showComment?: boolean
}

const CHANNEL_LABEL: Record<string, string> = {
  instagram_post:    'Instagram',
  instagram_stories: 'Stories',
  email:             'Email',
  sms:               'SMS',
  tiktok:            'TikTok',
}

export default function ContentCard({ item, basePath, showComment = false }: Props) {
  const navigate = useNavigate()
  const thumb = item.feed_post_url || item.lifestyle_url
  const isFlagged = item.status === 'changes_requested'

  return (
    <div
      onClick={() => navigate(`${basePath}/${item.id}`)}
      className="group flex items-center gap-4 rounded-lg p-4 cursor-pointer transition-all"
      style={{
        background: isFlagged ? '#fff9f8' : '#ffffff',
        border: isFlagged ? '1px solid #f5c2be' : '1px solid #dde2f0',
        borderLeft: isFlagged ? '2px solid #DC2626' : '1px solid #dde2f0',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
      onMouseLeave={e => (e.currentTarget.style.background = isFlagged ? '#fff9f8' : '#ffffff')}
    >
      {/* Thumbnail */}
      <div
        className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
        style={{ background: '#f4f6fb', border: '1px solid #dde2f0' }}
      >
        {thumb
          ? <img src={thumb} alt={item.product_name} className="w-full h-full object-cover" />
          : <Image size={22} style={{ color: '#8892b8' }} />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate" style={{ color: '#1a1f3a' }}>{item.product_name}</p>
          <StatusBadge status={item.status} />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs" style={{ color: '#8892b8' }}>{item.brand_key.toUpperCase()}</span>
          <span className="text-xs" style={{ color: '#dde2f0' }}>·</span>
          <span className="text-xs" style={{ color: '#4a5280' }}>{CHANNEL_LABEL[item.channel] ?? item.channel}</span>
          {item.scheduled_date && (
            <>
              <span className="text-xs" style={{ color: '#dde2f0' }}>·</span>
              <span className="text-xs" style={{ color: '#4a5280' }}>{item.scheduled_date}</span>
            </>
          )}
        </div>
        {showComment && isFlagged && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: '#b91c1c' }}>
            <AlertCircle size={11} />
            AI revision ready — review before sending to client
          </div>
        )}
      </div>
    </div>
  )
}
