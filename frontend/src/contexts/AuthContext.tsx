import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '../types'
import { api } from '../api/client'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    api.get<User>('/auth/me')
      .then(setUser)
      .catch(() => { localStorage.removeItem('token'); setToken(null) })
      .finally(() => setLoading(false))
  }, [token])

  const login = async (email: string, password: string) => {
    const form = new URLSearchParams({ username: email, password })
    const data = await api.postForm<{ access_token: string }>('/auth/login', form)
    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
    const me = await api.get<User>('/auth/me')
    setUser(me)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
