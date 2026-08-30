// 登录第二步（TOTP）：校验验证器验证码并建立会话
// 前置：密码已通过 login.ts 校验，并生成 totpChallengeId
import { json, error, readJson } from '../../_lib/helpers'
import { getChallenge, deleteChallenge } from '../../_lib/webauthn'
import { verifyTotp } from '../../_lib/totp'
import { createSession, sessionCookieHeaders, withSession } from '../../_lib/auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { challengeId, code } = await readJson(request)
  if (!challengeId || !code) return error('缺少必要参数')

  const stored = await getChallenge(env, challengeId)
  if (!stored || !stored.userId) return error('验证已失效，请重试')
  const payload = JSON.parse(stored.payload)
  if (payload.type !== 'totp') return error('验证已失效，请重试')

  const user = await env.DB.prepare(
    'SELECT id, username, totp_secret, totp_enabled FROM users WHERE id = ?'
  )
    .bind(stored.userId)
    .first()
  if (!user || !user.totp_enabled || !user.totp_secret) {
    return error('未绑定验证器，请重新登录', 400)
  }
  const ok = await verifyTotp(user.totp_secret as string, String(code).trim())
  if (!ok) return error('验证码错误', 401)

  await deleteChallenge(env, challengeId)
  const token = await createSession(env, stored.userId)
  return withSession(
    json({ ok: true, data: { user: { id: user.id, username: user.username } } }),
    sessionCookieHeaders(token, request)
  )
}
