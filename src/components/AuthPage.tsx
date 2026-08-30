import { useState } from 'react'
import { Bookmark, Fingerprint, ShieldCheck } from 'lucide-react'
import { registerWithPasskey, loginWithPasskey } from '../webauthn'
import { Button, Input } from './ui'
import type { User } from '../types'

export default function AuthPage({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    const name = username.trim()
    if (!name) {
      setErr('请输入用户名')
      return
    }
    setLoading(true)
    setErr('')
    try {
      const user =
        mode === 'register'
          ? await registerWithPasskey(name)
          : await loginWithPasskey(name)
      onAuth(user)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-4">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-fuchsia-300/10 blur-3xl" />

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur">
            <Bookmark className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">CloudFav 云收藏夹</h1>
          <p className="mt-1 text-sm text-indigo-100">
            基于 Cloudflare 的多用户云书签 · Passkey 免密登录
          </p>
        </div>

        <div className="rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur dark:bg-slate-900/95 sm:p-7">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m)
                  setErr('')
                }}
                className={`rounded-lg py-2 text-sm font-medium transition ${
                  mode === m
                    ? 'bg-white text-indigo-600 shadow dark:bg-slate-900 dark:text-indigo-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <Input
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoComplete="username"
              autoFocus
            />

            {err && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                {err}
              </p>
            )}

            <Button
              onClick={submit}
              loading={loading}
              className="w-full py-2.5 text-base"
            >
              <Fingerprint className="h-5 w-5" />
              {mode === 'register' ? '注册并创建通行密钥' : '使用通行密钥登录'}
            </Button>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
              使用 Passkey（指纹 / 面容 / 安全密钥 / 系统密码）进行无密码认证，凭据仅保存在本机，
              服务器不存储任何密码。首次注册后，登录时输入用户名并完成系统验证即可。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
