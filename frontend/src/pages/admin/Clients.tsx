import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { User } from '../../types'

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  admin:    { bg: '#e8eeff', color: '#1a2d82' },
  designer: { bg: '#f3e8ff', color: '#7e22ce' },
  client:   { bg: '#f0fdf4', color: '#15803d' },
}

export default function AdminClients() {
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => { api.get<User[]>('/auth/users').then(setUsers).catch(() => setUsers([])) }, [])

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-xl font-semibold mb-6" style={{ color: '#1a1f3a' }}>Clients</h1>
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #dde2f0', background: '#0f1a50' }}>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Brand</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: idx < users.length - 1 ? '1px solid #dde2f0' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <td className="px-5 py-3" style={{ color: '#1a1f3a' }}>{u.email}</td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
                      style={ROLE_STYLE[u.role] ?? { bg: '#f4f6fb', color: '#4a5280' }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3" style={{ color: '#8892b8' }}>{u.brand_key ?? '—'}</td>
                  <td className="px-5 py-3" style={{ color: '#8892b8' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm" style={{ color: '#8892b8' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
