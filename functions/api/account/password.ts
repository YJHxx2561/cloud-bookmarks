// 设置 / 修改密码（需登录）：已有密码时需校验当前密码；无密码用户直接设置
import { json, error, readJson } from '../../_lib/helpers'
import { hashPassword, verifyPassword } from '../../_lib/password'

export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const { currentPassword, newPassword } = await readJson(request)
  const pw = typeof newPassword === 'string' ? newPassword : ''
  if (pw.length < 8) return error('新密码至少需要 8 位')

  const user = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(userId)
    .first()
  if (!user) return error('用户不存在', 404)

  if (user.password_hash) {
    const cp = typeof currentPassword === 'string' ? currentPassword : ''
    if (!cp || !(await verifyPassword(cp, user.password_hash as string))) {
      return error('当前密码错误', 400)
    }
  }

  const hash = await hashPassword(pw)
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(hash, userId)
    .run()
  return json({ ok: true, data: { done: true } })
}
