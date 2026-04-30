import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Users, CalendarDays, PlusCircle,
  Inbox, MessageSquare, LogOut, History, Settings,
} from 'lucide-react'
import NotificationBell from './NotificationBell'

interface NavItem { label: string; to: string; icon: React.ElementType }

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard',      to: '/admin/dashboard',      icon: LayoutDashboard },
  { label: 'Campaign plan',  to: '/admin/plan',           icon: CalendarDays },
  { label: 'Suggestions',    to: '/admin/suggestions',    icon: MessageSquare },
  { label: 'Clients',        to: '/admin/clients',        icon: Users },
  { label: 'Onboarding',     to: '/admin/onboarding',     icon: PlusCircle },
  { label: 'Brand settings', to: '/admin/brand-settings', icon: Settings },
]

const DESIGNER_NAV: NavItem[] = [
  { label: 'Campaign plan', to: '/designer/plan',        icon: CalendarDays },
  { label: 'Suggestions',   to: '/designer/suggestions', icon: MessageSquare },
  { label: 'History',       to: '/designer/revisions',   icon: History },
]

const NAVY     = '#1a2d82'
const NAVY_DRK = '#0f1a50'
const GOLD     = '#f5b800'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const nav = user?.role === 'admin' ? ADMIN_NAV : DESIGNER_NAV
  const roleLabel = user?.role === 'admin' ? 'Admin' : user?.role === 'designer' ? 'Designer' : 'Client'

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside
      className="w-[200px] flex-shrink-0 min-h-screen flex flex-col"
      style={{ background: NAVY }}
    >
      {/* Logo / topbar section */}
      <div
        className="flex items-center gap-2.5 px-4 flex-shrink-0"
        style={{
          background: NAVY_DRK,
          height: 44,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: GOLD }}
        >
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path d="M4 14L14 4M14 4H7M14 4V11" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="font-bold text-white" style={{ fontSize: 14 }}>Progility CMS</span>
      </div>

      {/* Brand pill */}
      {user?.brand_key && (
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold"
            style={{
              border: '1px solid rgba(245,184,0,0.5)',
              color: GOLD,
              background: 'rgba(245,184,0,0.12)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GOLD }} />
            {user.brand_key.toUpperCase()}
          </span>
        </div>
      )}

      {/* Nav section */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 mb-2 uppercase tracking-widest font-semibold"
          style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}
        >
          Workspace
        </p>
        {nav.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive ? 'active-nav' : 'inactive-nav'
              }`
            }
            style={({ isActive }) => isActive
              ? { background: 'rgba(245,184,0,0.15)', color: GOLD }
              : { color: 'rgba(255,255,255,0.65)' }
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={14}
                  strokeWidth={1.8}
                  style={{ color: isActive ? GOLD : 'rgba(255,255,255,0.65)' }}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: notifications + user + sign out */}
      <div className="px-2.5 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <NotificationBell />

        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {user?.email}
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{roleLabel}</p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs transition-colors"
          style={{ color: 'rgba(255,255,255,0.5)', background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <LogOut size={14} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
