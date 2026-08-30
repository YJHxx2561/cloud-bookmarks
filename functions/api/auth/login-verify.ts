// 登录第二步：校验断言并建立会话
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { json, error, readJson, b64urlToBytes } from '../../_lib/helpers'
import { getChallenge, deleteChallenge } from '../../_lib/webauthn'
import { createSession, sessionCookieHeaders, withSession } from '../../_lib/auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { challengeId, credential } = await readJson(request)
  if (!challengeId || !credential) return error('缺少必要参数')

  const stored = await getChallenge(env, challengeId)
  if (!stored || !stored.userId) return error('验证已失效，请重试')
  const payload = JSON.parse(stored.payload)

  const passkey = await env.DB.prepare(
    'SELECT * FROM passkeys WHERE user_id = ? AND credential_id = ?'
  )
    .bind(stored.userId, credential.id)
    .first()
  if (!passkey) return error('未找到对应的通行密钥', 404)

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: payload.challenge,
      expectedOrigin: payload.origin,
      expectedRPID: payload.rpID,
      authenticator: {
        credentialID: b64urlToBytes(passkey.credential_id as string),
        credentialPublicKey: b64urlToBytes(passkey.public_key as string),
        counter: passkey.counter as number,
        transports: JSON.parse((passkey.transports as string) || '[]'),
      },
    })
  } catch {
    return error('通行密钥验证失败')
  }
  if (!verification.verified) return error('通行密钥验证失败')

  await env.DB.prepare('UPDATE passkeys SET counter = ? WHERE id = ?')
    .bind(verification.authenticationInfo.newCounter, passkey.id)
    .run()
  await deleteChallenge(env, challengeId)

  const user = await env.DB.prepare('SELECT id, username FROM users WHERE id = ?')
    .bind(stored.userId)
    .first()
  const token = await createSession(env, stored.userId)
  return withSession(json({ ok: true, data: { user } }), sessionCookieHeaders(token, request))
}
