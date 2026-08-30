// 重置密码：校验一次性 token 并更新密码
import { json, error, readJson, sha256Hex } from '../../_lib/helpers'
import { hashPassword } from '../../_lib/password'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { token, newPassword } = await readJson(request)
  const pw = typeof newPassword === 'string' ? newPassword : ''
  if (!token || !pw) return error('缺少必要参数')
  if (pw.length < 8) return error('新密码至少需要 8 位')

  const hash = await sha256Hex(String(token))
  const row = await env.DB.prepare(
    'SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?'
  )
    .bind(hash, Date.now())
    .first()
  if (!row) return error('重置链接无效或已过期，请重新申请', 400)

  const newHash = await hashPassword(pw)
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, row.user_id),
    env.DB.prepare('DELETE FROM password_resets WHERE token_hash = ?').bind(hash),
  ])
  return json({ ok: true, data: { done: true } })
}
