// 注册第二步：校验客户端凭证并创建用户与 Passkey
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import {
  json,
  error,
  readJson,
  generateId,
  bytesToB64url,
} from '../../_lib/helpers'
import { getChallenge, deleteChallenge } from '../../_lib/webauthn'
import { createSession, sessionCookieHeaders, withSession } from '../../_lib/auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { challengeId, username, credential } = await readJson(request)
  if (!challengeId || !credential || !username) return error('缺少必要参数')

  const stored = await getChallenge(env, challengeId)
  if (!stored || stored.username !== username) return error('验证已失效，请重试')
  const payload = JSON.parse(stored.payload)

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first()
  if (existing) return error('该用户名已被注册', 409)

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: payload.challenge,
      expectedOrigin: payload.origin,
      expectedRPID: payload.rpID,
    })
  } catch {
    return error('通行密钥验证失败')
  }
  if (!verification.verified || !verification.registrationInfo) {
    return error('通行密钥验证失败')
  }

  const { credentialPublicKey, credentialID, counter } = verification.registrationInfo
  const userId = stored.userId || generateId()

  await env.DB.batch([
    env.DB.prepare('INSERT INTO users (id, username, created_at) VALUES (?,?,?)').bind(
      userId,
      username,
      Date.now()
    ),
    env.DB.prepare(
      'INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, transports, created_at) VALUES (?,?,?,?,?,?,?)'
    ).bind(
      generateId(),
      userId,
      bytesToB64url(credentialID),
      bytesToB64url(credentialPublicKey),
      counter,
      JSON.stringify(credential.response?.transports ?? []),
      Date.now()
    ),
  ])
  await deleteChallenge(env, challengeId)

  const token = await createSession(env, userId)
  return withSession(
    json({ ok: true, data: { user: { id: userId, username } } }),
    sessionCookieHeaders(token, request)
  )
}
