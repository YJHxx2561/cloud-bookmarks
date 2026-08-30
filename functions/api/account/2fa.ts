// 双重认证（2FA）开关（需登录）：POST { enabled }
// 开启 2FA 要求用户已同时设置密码并至少绑定一个通行密钥
import { json, error, readJson } from '../../_lib/helpers'

export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const { enabled } = await readJson(request)
  const want = Boolean(enabled)

  if (want) {
    const user = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
      .bind(userId)
      .first()
    const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM passkeys WHERE user_id = ?')
      .bind(userId)
      .first()
    const totpRow = await env.DB.prepare('SELECT totp_enabled FROM users WHERE id = ?')
      .bind(userId)
      .first()
    if (!user?.password_hash) return error('请先设置密码再启用双重认证', 400)
    if (Number((count?.c as number) ?? 0) < 1 && !totpRow?.totp_enabled) {
      return error('请先绑定通行密钥或验证器应用再启用双重认证', 400)
    }
  }

  await env.DB.prepare('UPDATE users SET two_factor_enabled = ? WHERE id = ?')
    .bind(want ? 1 : 0, userId)
    .run()
  return json({ ok: true, data: { enabled: want } })
}
