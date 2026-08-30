// 账户信息（需登录）：GET 查询登录方式/邮箱/通行密钥，PATCH 更新邮箱
import { json, error, readJson } from '../_lib/helpers'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const user = await env.DB.prepare(
    'SELECT id, username, email, password_hash, two_factor_enabled, totp_enabled FROM users WHERE id = ?'
  )
    .bind(userId)
    .first()
  if (!user) return error('用户不存在', 404)

  const passkeys = await env.DB.prepare(
    'SELECT id, created_at FROM passkeys WHERE user_id = ? ORDER BY created_at'
  )
    .bind(userId)
    .all()

  return json({
    ok: true,
    data: {
      username: user.username,
      email: (user.email as string) || null,
      hasPassword: Boolean(user.password_hash),
      twoFactorEnabled: Boolean(user.two_factor_enabled),
      totpEnabled: Boolean(user.totp_enabled),
      passkeys: passkeys.results.map((p) => ({ id: p.id, createdAt: p.created_at })),
    },
  })
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const { email } = await readJson(request)
  const em = typeof email === 'string' ? email.trim() : ''
  if (em && !EMAIL_RE.test(em)) return error('邮箱格式不正确')

  await env.DB.prepare('UPDATE users SET email = ? WHERE id = ?')
    .bind(em || null, userId)
    .run()
  return json({ ok: true, data: { email: em || null } })
}
