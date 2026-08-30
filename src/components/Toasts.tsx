import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

let toasts: Toast[] = []
let toastId = 0
type Listener = (t: Toast[]) => void
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((l) => l([...toasts]))
}

export function toast(message: string, type: Toast['type'] = 'info') {
  const id = ++toastId
  toasts = [...toasts, { id, message, type }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, 3600)
}

export function toastError(e: unknown) {
  toast(e instanceof Error ? e.message : '操作失败，请重试', 'error')
}

export function useToasts(): Toast[] {
  const [state, setState] = useState<Toast[]>([])
  useEffect(() => {
    const l: Listener = (t) => setState(t)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return state
}

const icons = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  error: <XCircle className="h-4 w-4 text-rose-400" />,
  info: <Info className="h-4 w-4 text-sky-400" />,
}

export function ToastHost() {
  const toasts = useToasts()
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-sm shadow-lg backdrop-blur animate-fade-in dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-100"
        >
          {icons[t.type]}
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
