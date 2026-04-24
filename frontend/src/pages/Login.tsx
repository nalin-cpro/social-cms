import { useState, FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Loader2, Zap, Layout, CheckSquare, CalendarRange } from 'lucide-react'

const FEATURES = [
  { icon: Zap,           label: 'AI content generation',   sub: 'Copy and visuals in seconds' },
  { icon: CheckSquare,   label: 'Client approval workflow', sub: 'One-click review and sign-off' },
  { icon: CalendarRange, label: 'Campaign planning',        sub: 'Monthly content calendars' },
]

export default function Login() {
  const { login, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!authLoading && user) {
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
    if (user.role === 'designer') return <Navigate to="/designer/queue" replace />
    return <Navigate to="/client/review" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 px-10 py-10"
        style={{ background: '#1a2d82' }}>
        {/* Logo */}
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#f5b800' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 14L14 4M14 4H7M14 4V11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">Progility CMS</p>
              <p className="font-medium tracking-[0.14em] uppercase"
                style={{ fontSize: 10, color: 'rgba(245,184,0,0.7)' }}>Content Platform</p>
            </div>
          </div>

          <h1 className="text-white font-bold leading-tight mb-4" style={{ fontSize: 26 }}>
            Create content<br />that converts.
          </h1>
          <p className="leading-relaxed mb-10" style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
            From AI-generated copy to client-approved campaigns — your entire content workflow in one place.
          </p>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(245,184,0,0.18)' }}>
                  <Icon size={14} style={{ color: '#f5b800' }} />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{label}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          © Progility Consulting · Internal use only
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-white px-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1a2d82' }}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M4 14L14 4M14 4H7M14 4V11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-bold text-sm" style={{ color: '#1a2d82' }}>Progility CMS</span>
          </div>

          <h2 className="font-bold mb-1" style={{ fontSize: 24, color: '#1a1f3a' }}>Welcome back</h2>
          <p className="mb-8" style={{ fontSize: 13, color: '#4a5280' }}>Sign in to your workspace</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@company.com"
                className="w-full px-3 py-2.5 rounded-lg text-sm transition outline-none"
                style={{
                  border: '1px solid #dde2f0',
                  color: '#1a1f3a',
                  background: '#fff',
                }}
                onFocus={e => { e.target.style.borderColor = '#1a2d82'; e.target.style.boxShadow = '0 0 0 3px rgba(26,45,130,0.08)' }}
                onBlur={e => { e.target.style.borderColor = '#dde2f0'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg text-sm transition outline-none"
                style={{
                  border: '1px solid #dde2f0',
                  color: '#1a1f3a',
                  background: '#fff',
                }}
                onFocus={e => { e.target.style.borderColor = '#1a2d82'; e.target.style.boxShadow = '0 0 0 3px rgba(26,45,130,0.08)' }}
                onBlur={e => { e.target.style.borderColor = '#dde2f0'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {error && (
              <div className="text-xs px-3 py-2 rounded-lg"
                style={{ background: '#fff4f3', border: '1px solid #f5c2be', color: '#b91c1c' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 font-semibold rounded-lg transition-opacity disabled:opacity-50"
              style={{
                background: '#1a2d82',
                color: '#fff',
                fontSize: 14,
                height: 44,
              }}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="text-center mt-8" style={{ fontSize: 11, color: '#8892b8' }}>
            © {new Date().getFullYear()} Progility Consulting
          </p>
        </div>
      </div>
    </div>
  )
}
