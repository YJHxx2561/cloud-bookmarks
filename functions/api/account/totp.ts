// TOTP（验证器应用）绑定管理（需登录）
// POST { step: 'setup' }          → 生成新密钥并返回 secret / otpauth URI（待验证）
// POST { step: 'verify', code }   → 校验验证码并正式启用
// DELETE                          → 解绑验证器
import { json, error, readJson } from '../../_lib/helpers'
import { generateTotpSecret, verifyTotp, buildOtpauthUri } from '../../_lib/totp'

export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await readJson(request)
  const step = body.step

  if (step === 'setup') {
    const user = await env.DB.prepare('SELECT username, totp_enabled FROM users WHERE id = ?')
      .bind(userId)
      .first()
    if (user?.totp_enabled) return error('已绑定验证器，请先解绑再重新绑定', 400)
    const secret = generateTotpSecret()
    await env.DB.prepare('UPDATE users SET totp_secret = ? WHERE id = ?')
      .bind(secret, userId)
      .run()
    return json({ ok: true, data: { secret, uri: buildOtpauthUri(secret, user?.username as string) } })
  }

  if (step === 'verify') {
    const code = String(body.code ?? '').trim()
    const user = await env.DB.prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?')
      .bind(userId)
      .first()
    if (!user?.totp_secret) return error('请先获取验证器密钥', 400)
    if (user.totp_enabled) return error('验证器已绑定', 400)
    const ok = await verifyTotp(user.totp_secret as string, code)
    if (!ok) return error('验证码错误', 400)
    await env.DB.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').bind(userId).run()
    return json({ ok: true, data: { done: true } })
  }

  return error('无效的操作')
}

export const onRequestDelete: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const user = await env.DB.prepare(
    'SELECT password_hash, two_factor_enabled, totp_secret, totp_enabled FROM users WHERE id = ?'
  )
    .bind(userId)
    .first()
  if (!user?.totp_enabled && !user?.totp_secret) return error('未绑定验证器', 400)

  const passkeys = await env.DB.prepare('SELECT COUNT(*) AS c FROM passkeys WHERE user_id = ?')
    .bind(userId)
    .first()
  const batch = [
    env.DB.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').bind(userId),
  ]
  // 若 2FA 开启且无其他第二因素（通行密钥），自动关闭 2FA
  if (user.two_factor_enabled && Number((passkeys?.c as number) ?? 0) < 1) {
    batch.push(env.DB.prepare('UPDATE users SET two_factor_enabled = 0 WHERE id = ?').bind(userId))
  }
  await env.DB.batch(batch)
  return json({ ok: true, data: { done: true } })
}
