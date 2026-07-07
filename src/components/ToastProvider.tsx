import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface ToastAction { label: string; onClick: () => void }
interface Toast { id: number; message: string; type: 'error' | 'info'; action?: ToastAction; persist?: boolean }
interface ShowToastOptions { type?: 'error' | 'info'; action?: ToastAction; persist?: boolean }

interface ToastContextValue {
  showToast: (message: string, options?: ShowToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const showToast = useCallback((message: string, options: ShowToastOptions = {}) => {
    const id = ++idRef.current
    setToasts(t => [...t, { id, message, type: options.type ?? 'info', action: options.action, persist: options.persist }])
    if (!options.persist) {
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500)
    }
  }, [])

  function dismiss(id: number) {
    setToasts(t => t.filter(x => x.id !== id))
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-msg">{t.message}</span>
            {t.action && (
              <button className="toast-action" onClick={() => { t.action!.onClick(); dismiss(t.id) }}>
                {t.action.label}
              </button>
            )}
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Schließen">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
