// 登录第一步：生成 WebAuthn 断言选项（基于用户名找到其 Passkey）
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { json, error, readJson, b64urlToBytes, getRpInfo } from '../../_lib/helpers'
import { storeChallenge } from '../../_lib/webauthn'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { username } = await readJson(request)
  const name = String(username ?? '').trim()
  if (!name) return error('请输入用户名')

  const user = await env.DB.prepare('SELECT id, username FROM users WHERE username = ?')
    .bind(name)
    .first()
  if (!user) return error('用户不存在', 404)

  const passkeys = await env.DB.prepare(
    'SELECT credential_id, transports FROM passkeys WHERE user_id = ?'
  )
    .bind(user.id)
    .all()
  if (!passkeys.results.length) return error('该用户尚未绑定任何通行密钥', 400)

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
    challenge: options.challenge,
    rpID,
    origin,
  })
  return json({ ok: true, data: { challengeId, options } })
}
