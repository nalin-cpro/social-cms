const BASE = '/api'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers })

  if (res.status === 401) {
    localStorage.removeItem('token')
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || 'Request failed')
  }

  if (res.status === 204) return undefined as unknown as T
  return res.json()
}

async function requestMultipart<T>(path: string, formData: FormData, method = 'POST'): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await fetch(`${BASE}${path}`, { method, headers, body: formData })
  if (res.status === 401) { localStorage.removeItem('token'); throw new Error('Unauthorized') }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || 'Request failed')
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  postForm: <T>(path: string, data: URLSearchParams) =>
    request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: data.toString(),
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postMultipart: <T>(path: string, data: FormData) => requestMultipart<T>(path, data),
}
