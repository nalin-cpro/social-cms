import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { api } from '../api/client'
import { Notification } from '../types'

export default function NotificationBell() {
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const unread = notifs.filter(n => !n.read).length

  useEffect(() => {
    api.get<Notification[]>('/notifications').then(setNotifs).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await api.post(`/notifications/${n.id}/read`)
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    }
    setOpen(false)
    if (n.content_item_id) navigate(`/designer/content/${n.content_item_id}`)
  }

  return (
    <div ref={ref} className="relative px-0.5 mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs transition-colors"
        style={{ color: 'rgba(255,255,255,0.65)', background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#243595')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="relative flex-shrink-0">
          <Bell size={14} strokeWidth={1.8} />
          {unread > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
              style={{ background: '#DC2626', color: '#fff', fontSize: 8 }}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
        <span>Notifications</span>
        {unread > 0 && (
          <span className="ml-auto text-xs font-semibold" style={{ color: '#DC2626' }}>{unread}</span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 bottom-full mb-2 w-72 rounded-xl shadow-xl z-50 overflow-hidden"
          style={{ background: '#fff', border: '1px solid #dde2f0' }}
        >
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #dde2f0' }}>
            <p className="text-xs font-semibold" style={{ color: '#1a1f3a' }}>Notifications</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: '#8892b8' }}>No notifications</p>
            ) : (
              notifs.slice(0, 10).map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full text-left px-4 py-3 transition-colors"
                  style={{
                    borderBottom: '1px solid #dde2f0',
                    background: n.read ? '#fff' : '#f4f6fb',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.read ? '#fff' : '#f4f6fb')}
                >
                  <p className="text-xs leading-snug" style={{ color: n.read ? '#4a5280' : '#1a1f3a', fontWeight: n.read ? 400 : 500 }}>
                    {n.message}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#8892b8' }}>
                    {new Date(n.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
