import { useCallback, useEffect, useState } from 'react'
import {
  Fingerprint,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api'
import { addAccountPasskey } from '../webauthn'
import { Button, Field, Input, Modal } from './ui'
import { toast, toastError } from './Toasts'
import type { User } from '../types'

type AccountInfo = {
  username: string
  email: string | null
  hasPassword: boolean
  twoFactorEnabled: boolean
  totpEnabled: boolean
  passkeys: { id: string; createdAt: number }[]
}

export default function SettingsModal({
  open,
  user,
  onClose,
}: {
  open: boolean
  user: User
  onClose: () => void
}) {
  const [info, setInfo] = useState<AccountInfo | null>(null)

  const [email, setEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  const [pkBusy, setPkBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [faBusy, setFaBusy] = useState(false)

  const [totpSetup, setTotpSetup] = useState<{ secret: string; uri: string } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpBusy, setTotpBusy] = useState(false)

  const refresh = useCallback(async () => {
    const d = await api.account()
    setInfo(d.data)
    setEmail(d.data.email ?? '')
    setCurrentPassword('')
    setNewPassword('')
    setTotpSetup(null)
    setTotpCode('')
  }, [])

  useEffect(() => {
    if (open) {
      refresh().catch(toastError)
    }
  }, [open, refresh])

  // ---------- 邮箱 ----------
  const saveEmail = async () => {
    setEmailBusy(true)
    try {
      await api.updateEmail(email.trim())
      await refresh()
      toast('邮箱已更新', 'success')
    } catch (e) {
      toastError(e)
    } finally {
      setEmailBusy(false)
    }
  }

  // ---------- 密码 ----------
  const savePassword = async () => {
    if (newPassword.length < 8) {
      toastError('新密码至少需要 8 位')
      return
    }
    setPwBusy(true)
    try {
      await api.changePassword(currentPassword || null, newPassword)
      await refresh()
      toast('密码已更新', 'success')
    } catch (e) {
      toastError(e)
    } finally {
      setPwBusy(false)
    }
  }

  // ---------- 通行密钥 ----------
  const handleAddPasskey = async () => {
    setPkBusy(true)
    try {
      await addAccountPasskey()
      await refresh()
      toast('通行密钥已添加', 'success')
    } catch (e) {
      toastError(e)
    } finally {
      setPkBusy(false)
    }
  }

  const handleDeletePasskey = async (id: string) => {
    setDeletingId(id)
    try {
      await api.deletePasskey(id)
      await refresh()
      toast('通行密钥已移除', 'success')
    } catch (e) {
      toastError(e)
    } finally {
      setDeletingId(null)
    }
  }

  // ---------- 双重认证 ----------
  const handleToggle2FA = async () => {
    if (!info) return
    const want = !info.twoFactorEnabled
    if (want && (!info.hasPassword || (info.passkeys.length === 0 && !info.totpEnabled))) {
      toastError('双重认证需要先设置密码，并绑定通行密钥或验证器应用')
      return
    }
    setFaBusy(true)
    try {
      await api.toggle2FA(want)
      await refresh()
      toast(want ? '已开启双重认证' : '已关闭双重认证', 'success')
    } catch (e) {
      toastError(e)
    } finally {
      setFaBusy(false)
    }
  }

  // ---------- 验证器应用（TOTP） ----------
  const handleTotpSetup = async () => {
    setTotpBusy(true)
    try {
      const d = await api.totpSetup()
      setTotpSetup(d.data)
      setTotpCode('')
      toast('请在验证器应用中添加账户', 'info')
    } catch (e) {
      toastError(e)
    } finally {
      setTotpBusy(false)
    }
  }

  const handleTotpVerify = async () => {
    if (!/^\d{6}$/.test(totpCode.trim())) return toastError('请输入 6 位验证码')
    setTotpBusy(true)
    try {
      await api.totpVerify(totpCode.trim())
      await refresh()
      toast('验证器已绑定', 'success')
    } catch (e) {
      toastError(e)
    } finally {
      setTotpBusy(false)
    }
  }

  const handleTotpDelete = async () => {
    setTotpBusy(true)
    try {
      await api.totpDelete()
      await refresh()
      toast('验证器已解绑', 'success')
    } catch (e) {
      toastError(e)
    } finally {
      setTotpBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="账户设置" width="max-w-xl">
      {!info ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-7">
          {/* 邮箱 */}
          <section>
            <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Mail className="h-4 w-4 text-indigo-500" /> 绑定邮箱
            </h4>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              用于找回密码。未配置邮件服务时，找回链接会直接显示在页面上（仅限演示环境）。
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button variant="secondary" onClick={saveEmail} loading={emailBusy} className="shrink-0">
                保存
              </Button>
            </div>
          </section>

          {/* 密码 */}
          <section>
            <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <KeyRound className="h-4 w-4 text-indigo-500" /> 登录密码
            </h4>
            {info.hasPassword ? (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="当前密码"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <Input
                  type="password"
                  placeholder="新密码（至少 8 位）"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <Button onClick={savePassword} loading={pwBusy} variant="secondary">
                  修改密码
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  当前未设置密码，仅能通过通行密钥登录。设置密码后可支持「密码 / 密码+通行密钥」登录。
                </p>
                <Input
                  type="password"
                  placeholder="设置新密码（至少 8 位）"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <Button onClick={savePassword} loading={pwBusy}>
                  设置密码
                </Button>
              </div>
            )}
          </section>

          {/* 双重认证 */}
          <section>
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <ShieldCheck className="h-4 w-4 text-indigo-500" /> 双重认证（2FA）
              </h4>
              <button
                onClick={handleToggle2FA}
                disabled={faBusy}
                className="relative h-6 w-11 rounded-full transition disabled:opacity-50"
                style={{
                  backgroundColor: info.twoFactorEnabled ? '#4f46e5' : '#cbd5e1',
                }}
                title={info.twoFactorEnabled ? '关闭双重认证' : '开启双重认证'}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                  style={{ left: info.twoFactorEnabled ? 22 : 2 }}
                />
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {info.twoFactorEnabled
                ? '已开启：登录需「密码 + 通行密钥 / 验证码」两步共同验证，更安全。'
                : '未开启：密码、通行密钥、验证器可各自独立使用。'}
              开启双重认证需已设置密码，并绑定至少一个第二因素（通行密钥或验证器应用）。
            </p>
          </section>

          {/* 通行密钥 */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Fingerprint className="h-4 w-4 text-indigo-500" /> 通行密钥
              </h4>
              <Button variant="secondary" className="!px-2.5 !py-1.5 text-xs" onClick={handleAddPasskey} loading={pkBusy}>
                <Plus className="h-3.5 w-3.5" /> 添加
              </Button>
            </div>
            {info.passkeys.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                尚未绑定任何通行密钥。
                {info.hasPassword
                  ? '绑定后可作为独立的登录方式，也可用作双重认证的第二因素。'
                  : '绑定后可使用通行密钥免密登录。'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {info.passkeys.map((pk) => (
                  <li key={pk.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-700 dark:text-slate-200">{pk.id.slice(0, 12)}…</p>
                      <p className="text-xs text-slate-400">
                        添加于 {new Date(pk.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeletePasskey(pk.id)}
                      disabled={deletingId === pk.id}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50 dark:hover:bg-rose-950/40"
                      title="删除通行密钥"
                    >
                      {deletingId === pk.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {info.passkeys.length > 0 && info.hasPassword && (
              <p className="mt-2 text-xs text-slate-400">
                密码、通行密钥、验证器互为独立的第二因素；开启双重认证后登录才需要共同验证。
              </p>
            )}
          </section>

          {/* 验证器应用（TOTP） */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Smartphone className="h-4 w-4 text-indigo-500" /> 验证器应用（TOTP）
              </h4>
              {info.totpEnabled ? (
                <Button
                  variant="danger"
                  className="!px-2.5 !py-1.5 text-xs"
                  onClick={handleTotpDelete}
                  loading={totpBusy}
                >
                  <Trash2 className="h-3.5 w-3.5" /> 解绑
                </Button>
              ) : !totpSetup ? (
                <Button
                  variant="secondary"
                  className="!px-2.5 !py-1.5 text-xs"
                  onClick={handleTotpSetup}
                  loading={totpBusy}
                >
                  <Plus className="h-3.5 w-3.5" /> 绑定
                </Button>
              ) : null}
            </div>
            {info.totpEnabled ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                已绑定验证器应用，可生成动态验证码，作为双重认证的第二因素。
              </p>
            ) : totpSetup ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  使用验证器应用（如 Google Authenticator、Authy、1Password）扫描下方二维码，或手动输入密钥，
                  然后输入应用显示的 6 位验证码完成绑定。
                </p>
                <div className="flex justify-center rounded-xl bg-white p-3 dark:bg-slate-800">
                  <QRCodeSVG value={totpSetup.uri} size={160} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-400">手动输入密钥</p>
                  <Input readOnly value={totpSetup.secret} className="text-center font-mono tracking-wider" />
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="6 位验证码"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && handleTotpVerify()}
                    inputMode="numeric"
                    maxLength={6}
                    className="text-center tracking-widest"
                    autoFocus
                  />
                  <Button onClick={handleTotpVerify} loading={totpBusy} className="shrink-0">
                    完成绑定
                  </Button>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                可选。绑定后可在支持 TOTP 的验证器应用中生成动态验证码，作为双重认证的第二因素。
              </p>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
