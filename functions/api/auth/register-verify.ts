// 注册第二步：校验客户端凭证并创建用户 / 为用户补挂通行密钥，随后建立会话
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import {
  json,
  error,
  readJson,
  generateId,
  bytesToB64url,
} from '../../_lib/helpers'
import { getChallenge, deleteChallenge } from '../../_lib/webauthn'
import { createSessionResponse } from '../../_lib/auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { challengeId, username, credential } = await readJson(request)
  if (!challengeId || !credential || !username) return error('缺少必要参数')

  const stored = await getChallenge(env, challengeId)
  if (!stored || stored.username !== username) return error('验证已失效，请重试')
  const payload = JSON.parse(stored.payload)

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
  const credentialB64 = bytesToB64url(credentialID)

  const dup = await env.DB.prepare('SELECT id FROM passkeys WHERE credential_id = ?')
    .bind(credentialB64)
    .first()
  if (dup) return error('该通行密钥已被使用', 409)

  // 用户可能已在第一步（密码注册）创建，此时只补挂凭据；否则创建用户
  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first()
  const userId = existing ? (existing.id as string) : stored.userId || generateId()

  const batch = [
    ...(!existing
      ? [
          env.DB.prepare('INSERT INTO users (id, username, created_at) VALUES (?,?,?)').bind(
            userId,
            username,
            Date.now()
          ),
        ]
      : []),
    env.DB.prepare(
      'INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, transports, created_at) VALUES (?,?,?,?,?,?,?)'
    ).bind(
      generateId(),
      userId,
      credentialB64,
      bytesToB64url(credentialPublicKey),
      counter,
      JSON.stringify(credential.response?.transports ?? []),
      Date.now()
    ),
  ]
  await env.DB.batch(batch)
  await deleteChallenge(env, challengeId)

  return createSessionResponse(env, request, userId, {
    ok: true,
    data: { user: { id: userId, username } },
  })
}
