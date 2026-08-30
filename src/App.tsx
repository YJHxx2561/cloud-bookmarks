import { useEffect, useState } from 'react'
import { api } from './api'
import { AuthPage, Main, ToastHost } from './components'
import type { User } from './types'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => {})
      .finally(() => setBooting(false))
  }, [])

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-sm">正在加载…</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {user ? <Main user={user} onLogout={() => setUser(null)} /> : <AuthPage onAuth={setUser} />}
      <ToastHost />
    </>
  )
}
