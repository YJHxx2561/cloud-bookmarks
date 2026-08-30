import { useEffect, useState } from 'react'
import { Bookmark, Fingerprint, KeyRound, Mail, ShieldCheck, ArrowLeft } from 'lucide-react'
import { api } from '../api'
import {
  registerWithOptions,
  authenticateWithOptions,
  loginWithPasskey,
} from '../webauthn'
import { Button, Input, Field } from './ui'
import type { User } from '../types'

type View = 'login' | 'register' | 'forgot' | 'reset'

type TwoFaContext = {
  methods: { passkey: boolean; totp: boolean }
  challengeId?: string
  options?: any
  totpChallengeId?: string
}

export default function AuthPage({ onAuth }: { onAuth: (u: User) => void }) {
  const [view, setView] = useState<View>('login')
  // 从 URL 读取重置 token：/?reset=xxx
  const [resetToken] = useState(() => new URLSearchParams(location.search).get('reset') || '')

  // 通用状态
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  // 登录 / 注册字段
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [setupPasskey, setSetupPasskey] = useState(false)
  const [enable2fa, setEnable2fa] = useState(false)
  const [password2, setPassword2] = useState('')
  const [forgotUser, setForgotUser] = useState('')
  // 登录第二步（双重认证）
  const [fa2, setFa2] = useState<TwoFaContext | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [fa2Busy, setFa2Busy] = useState(false)

  useEffect(() => {
    if (resetToken) setView('reset')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = (v: View) => {
    setView(v)
    setErr('')
    setInfo('')
    setFa2(null)
    setTotpCode('')
  }

  // ---------- 登录 ----------
  const submitLogin = async () => {
    const name = username.trim()
    if (!name) return setErr('请输入用户名')
    if (!password) return setErr('请输入密码')
    setLoading(true)
    setErr('')
    try {
      const d = await api.login({ username: name, password })
      if (d.data.next === '2fa') {
        const ctx: TwoFaContext = {
          methods: d.data.methods ?? { passkey: false, totp: false },
          challengeId: d.data.challengeId,
          options: d.data.options,
          totpChallengeId: d.data.totpChallengeId,
        }
        // 仅绑定通行密钥时，自动继续 WebAuthn 第二步
        if (ctx.methods.passkey && !ctx.methods.totp) {
          const user = await authenticateWithOptions(ctx.options!, ctx.challengeId!)
          onAuth(user)
          return
        }
        setPassword('')
        setTotpCode('')
        setFa2(ctx)
        return
      }
      onAuth(d.data.user!)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // ---------- 2FA 第二步：验证器验证码 ----------
  const submitTotp = async () => {
    if (!fa2?.totpChallengeId) return setErr('验证已失效，请重新登录')
    if (!/^\d{6}$/.test(totpCode.trim())) return setErr('请输入 6 位验证码')
    setFa2Busy(true)
    setErr('')
    try {
      const d = await api.loginTotp(fa2.totpChallengeId, totpCode.trim())
      onAuth(d.data.user)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '验证失败，请重试')
    } finally {
      setFa2Busy(false)
    }
  }

  // ---------- 2FA 第二步：通行密钥 ----------
  const submit2faPasskey = async () => {
    if (!fa2?.challengeId) return setErr('验证已失效，请重新登录')
    setFa2Busy(true)
    setErr('')
    try {
      const user = await authenticateWithOptions(fa2.options!, fa2.challengeId!)
      onAuth(user)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '通行密钥验证失败')
    } finally {
      setFa2Busy(false)
    }
  }

  const submitPasskeyLogin = async () => {
    const name = username.trim()
    if (!name) return setErr('请输入用户名')
    setLoading(true)
    setErr('')
    try {
      const user = await loginWithPasskey(name)
      onAuth(user)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '通行密钥登录失败')
    } finally {
      setLoading(false)
    }
  }

  // ---------- 注册 ----------
  const submitRegister = async () => {
    const name = username.trim()
    if (!name) return setErr('请输入用户名')
    if (!password && !setupPasskey) return setErr('请设置密码或勾选启用通行密钥')
    if (password && password.length < 8) return setErr('密码至少需要 8 位')
    if (password !== password2) return setErr('两次输入的密码不一致')
    if (enable2fa && (!password || !setupPasskey)) return setErr('双重认证需要同时设置密码并启用通行密钥')
    setLoading(true)
    setErr('')
    try {
      const d = await api.register({
        username: name,
        password: password || undefined,
        email: email.trim() || undefined,
        setupPasskey,
        enable2fa,
      })
      if (d.data.next === 'passkey') {
        const user = await registerWithOptions(
          d.data.options!,
          name,
          d.data.challengeId!
        )
        onAuth(user)
        return
      }
      onAuth(d.data.user!)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // ---------- 找回密码 ----------
  const submitForgot = async () => {
    const name = forgotUser.trim()
    if (!name) return setErr('请输入用户名')
    setLoading(true)
    setErr('')
    setInfo('')
    try {
      const d = await api.forgot(name)
      setInfo(d.message || '已发送')
      if (d.data?.resetLink) {
        setInfo(`${d.message || '重置链接'}：${d.data.resetLink}`)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // ---------- 重置密码 ----------
  const submitReset = async () => {
    if (!resetToken) return setErr('重置链接无效，请重新申请')
    if (password.length < 8) return setErr('新密码至少需要 8 位')
    if (password !== password2) return setErr('两次输入的密码不一致')
    setLoading(true)
    setErr('')
    try {
      await api.resetPassword(resetToken, password)
      // 清除 URL 中的 token
      const u = new URL(location.href)
      u.searchParams.delete('reset')
      history.replaceState(null, '', u)
      setInfo('密码已重置，请使用新密码登录')
      setView('login')
      setPassword('')
      setPassword2('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : '重置失败，请重试')
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
            基于 Cloudflare 的多用户云书签 · 密码 / 通行密钥 / 双重认证
          </p>
        </div>

        <div className="rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur dark:bg-slate-900/95 sm:p-7">
          {/* 视图切换 */}
          {view !== 'forgot' && view !== 'reset' && (
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => reset(m)}
                  className={`rounded-lg py-2 text-sm font-medium transition ${
                    view === m
                      ? 'bg-white text-indigo-600 shadow dark:bg-slate-900 dark:text-indigo-400'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {m === 'login' ? '登录' : '注册'}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {err && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                {err}
              </p>
            )}
            {info && (
              <p className="break-all rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {info}
              </p>
            )}

            {/* ===== 登录 ===== */}
            {view === 'login' && !fa2 && (
              <>
                <Input
                  placeholder="用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
                <Input
                  type="password"
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitLogin()}
                  autoComplete="current-password"
                />
                <Button
                  onClick={submitLogin}
                  loading={loading}
                  className="w-full py-2.5 text-base"
                >
                  <KeyRound className="h-5 w-5" />
                  密码登录
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button
                    onClick={() => reset('forgot')}
                    className="text-slate-500 hover:text-indigo-500 dark:text-slate-400 dark:hover:text-indigo-400"
                  >
                    忘记密码？
                  </button>
                  <button
                    onClick={submitPasskeyLogin}
                    disabled={loading}
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-500 disabled:opacity-50 dark:text-slate-400 dark:hover:text-indigo-400"
                  >
                    <Fingerprint className="h-4 w-4" />
                    使用通行密钥登录
                  </button>
                </div>
              </>
            )}

            {/* ===== 登录第二步：双重认证 ===== */}
            {view === 'login' && fa2 && (
              <>
                <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <ShieldCheck className="mr-1 inline h-4 w-4" />
                  密码验证通过，请完成第二步验证
                </div>
                {fa2.methods.totp && (
                  <>
                    <Input
                      placeholder="6 位验证码"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onKeyDown={(e) => e.key === 'Enter' && submitTotp()}
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="one-time-code"
                      autoFocus
                    />
                    <Button
                      onClick={submitTotp}
                      loading={fa2Busy}
                      className="w-full py-2.5 text-base"
                    >
                      <KeyRound className="h-5 w-5" />
                      验证码登录
                    </Button>
                  </>
                )}
                {fa2.methods.passkey && (
                  <Button
                    variant="secondary"
                    onClick={submit2faPasskey}
                    loading={fa2Busy}
                    className="w-full py-2.5 text-base"
                  >
                    <Fingerprint className="h-5 w-5" />
                    使用通行密钥验证
                  </Button>
                )}
                <button
                  onClick={() => {
                    setFa2(null)
                    setErr('')
                  }}
                  className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-500 dark:text-slate-400 dark:hover:text-indigo-400"
                >
                  <ArrowLeft className="h-4 w-4" /> 返回重新输入密码
                </button>
              </>
            )}

            {/* ===== 注册 ===== */}
            {view === 'register' && (
              <>
                <Field
                  label="用户名"
                  hint={<span className="text-xs font-normal text-slate-400">2-32 位</span>}
                >
                  <Input
                    placeholder="用于登录的用户名"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                  />
                </Field>
                <Field label="密码" hint={<span className="text-xs font-normal text-slate-400">至少 8 位</span>}>
                  <Input
                    type="password"
                    placeholder="设置登录密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
                <Input
                  type="password"
                  placeholder="确认密码"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  autoComplete="new-password"
                />
                <Field label="邮箱（可选）" hint={<span className="text-xs font-normal text-slate-400">用于找回密码</span>}>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </Field>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={setupPasskey}
                    onChange={(e) => {
                      setSetupPasskey(e.target.checked)
                      if (!e.target.checked) setEnable2fa(false)
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    启用通行密钥（可选）
                    <span className="block text-xs text-slate-400">
                      绑定后可用通行密钥免密登录（无需每次都输密码）
                    </span>
                  </span>
                </label>
                {setupPasskey && password && (
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={enable2fa}
                      onChange={(e) => setEnable2fa(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      启用双重认证（2FA，可选）
                      <span className="block text-xs text-slate-400">
                        开启后登录需「密码 + 通行密钥」两步共同验证；不开启时两者可各自单独登录
                      </span>
                    </span>
                  </label>
                )}
                <Button
                  onClick={submitRegister}
                  loading={loading}
                  className="w-full py-2.5 text-base"
                >
                  <ShieldCheck className="h-5 w-5" />
                  注册
                </Button>
                <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                  密码将使用 PBKDF2 加盐哈希后存储，服务器不保存明文。可仅用密码登录，也可绑定
                  通行密钥后用任一种方式登录；双重认证为可选增强，需密码与通行密钥共同验证。
                </p>
              </>
            )}

            {/* ===== 忘记密码 ===== */}
            {view === 'forgot' && (
              <>
                <Input
                  placeholder="用户名"
                  value={forgotUser}
                  onChange={(e) => setForgotUser(e.target.value)}
                  autoFocus
                />
                <Button
                  onClick={submitForgot}
                  loading={loading}
                  className="w-full py-2.5 text-base"
                >
                  <Mail className="h-5 w-5" />
                  发送重置链接
                </Button>
                <button
                  onClick={() => reset('login')}
                  className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-500 dark:text-slate-400 dark:hover:text-indigo-400"
                >
                  <ArrowLeft className="h-4 w-4" /> 返回登录
                </button>
              </>
            )}

            {/* ===== 重置密码 ===== */}
            {view === 'reset' && (
              <>
                <Input
                  type="password"
                  placeholder="新密码（至少 8 位）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
                <Input
                  type="password"
                  placeholder="确认新密码"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitReset()}
                  autoComplete="new-password"
                />
                <Button
                  onClick={submitReset}
                  loading={loading}
                  className="w-full py-2.5 text-base"
                >
                  <KeyRound className="h-5 w-5" />
                  重置密码
                </Button>
                <button
                  onClick={() => reset('login')}
                  className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-500 dark:text-slate-400 dark:hover:text-indigo-400"
                >
                  <ArrowLeft className="h-4 w-4" /> 返回登录
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
