// 密码登录：验证密码后，若该用户还绑定了通行密钥则进入 2FA 第二步（调 login-verify）
// 返回 next:
//   - '2fa':  密码正确，还需完成通行密钥验证
//   - 'done': 仅密码用户，登录完成，已建立会话
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { json, error, readJson, b64urlToBytes, getRpInfo } from '../../_lib/helpers'
import { verifyPassword } from '../../_lib/password'
import { storeChallenge } from '../../_lib/webauthn'
import { createSessionResponse } from '../../_lib/auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { username, password } = await readJson(request)
  const name = String(username ?? '').trim()
  const pw = typeof password === 'string' ? password : ''
  if (!name || !pw) return error('请输入用户名和密码')

  const user = await env.DB.prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .bind(name)
    .first()
  if (!user) return error('用户名或密码错误', 401)
  if (!user.password_hash) return error('该账号未设置密码，请使用通行密钥登录', 400)
  const ok = await verifyPassword(pw, user.password_hash as string)
  if (!ok) return error('用户名或密码错误', 401)

  // 绑定过通行密钥 → 双重认证：第二步仍需通行密钥
  const passkeys = await env.DB.prepare('SELECT credential_id, transports FROM passkeys WHERE user_id = ?')
    .bind(user.id)
    .all()
  if (passkeys.results.length) {
    const { origin, rpID } = getRpInfo(request)
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: passkeys.results.map((p) => ({
        id: b64urlToBytes(p.credential_id as string),
        type: 'public-key' as const,
        transports: JSON.parse((p.transports as string) || '[]'),
      })),
    })
    const challengeId = await storeChallenge(env, {
      userId: user.id as string,
      username: user.username as string,
      challenge: options.challenge,
      rpID,
      origin,
    })
    return json({ ok: true, data: { next: '2fa', challengeId, options } })
  }

  return createSessionResponse(env, request, user.id as string, {
    ok: true,
    data: { next: 'done', user: { id: user.id, username: user.username } },
  })
}
