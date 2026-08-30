// 忘记密码：生成一次性重置链接并通过邮件发送
// 未配置邮件发送（MAIL_FROM / RESEND_API_KEY）时，直接把重置链接返回给前端（仅限本地/演示）
import { json, error, readJson, randomToken, sha256Hex } from '../../_lib/helpers'
import { isMailConfigured, sendMail } from '../../_lib/mail'

const RESET_TTL_MS = 30 * 60 * 1000 // 30 分钟

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { username } = await readJson(request)
  const name = String(username ?? '').trim()
  if (!name) return error('请输入用户名')

  const user = await env.DB.prepare('SELECT id, username, email FROM users WHERE username = ?')
    .bind(name)
    .first()

  if (!user) {
    return json({ ok: true, message: '如果该账号存在，重置链接将发送到其绑定的邮箱' })
  }
  if (!user.email) {
    return json({
      ok: true,
      message: '该账号未绑定邮箱，无法通过邮件找回；若绑定过通行密钥，可直接用通行密钥登录后在设置中重设密码',
    })
  }

  const token = await randomToken(32)
  const hash = await sha256Hex(token)
  await env.DB.batch([
    env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id),
    env.DB.prepare(
      'INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(hash, user.id, Date.now(), Date.now() + RESET_TTL_MS),
  ])

  const url = new URL(request.url)
  const resetLink = `${url.origin}/?reset=${token}`
  const subject = 'CloudFav 密码重置'
  const text = [
    `你好 ${user.username}：`,
    '',
    '我们收到了你的密码重置请求。请打开以下链接设置新密码（30 分钟内有效）：',
    '',
    resetLink,
    '',
    '如果这不是你的操作，请忽略本邮件。',
  ].join('\n')

  if (isMailConfigured(env)) {
    const sent = await sendMail(env, user.email as string, subject, text)
    if (!sent) return error('邮件发送失败，请稍后重试或联系管理员', 500)
    return json({ ok: true, message: '重置链接已发送至你的绑定邮箱，请查收' })
  }

  return json({
    ok: true,
    data: { resetLink },
    message: '未配置邮件服务，重置链接如下（生产环境请配置 MAIL_FROM 或 RESEND_API_KEY 后通过邮件发送）',
  })
}
