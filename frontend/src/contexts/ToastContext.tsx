import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; type: ToastType }

interface ToastCtx { toast: (message: string, type?: ToastType) => void }
const ToastContext = createContext<ToastCtx>({ toast: () => {} })

let _id = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200)
  }, [])

  const STYLE: Record<ToastType, { bg: string; border: string; color: string }> = {
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
    error:   { bg: '#fff4f3', border: '#f5c2be', color: '#b91c1c' },
    info:    { bg: '#e8eeff', border: '#c7d2fe', color: '#1a2d82' },
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="px-4 py-3 rounded-xl text-xs font-medium shadow-lg pointer-events-auto animate-in fade-in slide-in-from-bottom-2"
            style={{
              background: STYLE[t.type].bg,
              border: `1px solid ${STYLE[t.type].border}`,
              color: STYLE[t.type].color,
              minWidth: 220,
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
