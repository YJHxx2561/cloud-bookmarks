// 通行密钥管理（需登录）：POST 添加（options / verify 两步），DELETE 移除
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import {
  json,
  error,
  readJson,
  generateId,
  getRpInfo,
  bytesToB64url,
} from '../../_lib/helpers'
import { storeChallenge, getChallenge, deleteChallenge } from '../../_lib/webauthn'

export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await readJson(request)

  if (body.step === 'options') {
    const user = await env.DB.prepare('SELECT username FROM users WHERE id = ?')
      .bind(userId)
      .first()
    if (!user) return error('用户不存在', 404)

    const { origin, rpID } = getRpInfo(request)
    const options = await generateRegistrationOptions({
      rpName: 'CloudFav 云收藏夹',
      rpID,
      userName: user.username as string,
      userID: userId,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    })
    const challengeId = await storeChallenge(env, {
      userId,
      username: user.username as string,
      challenge: options.challenge,
      rpID,
      origin,
    })
    return json({ ok: true, data: { challengeId, options } })
  }

  if (body.step === 'verify') {
    const { challengeId, credential } = body
    if (!challengeId || !credential) return error('缺少必要参数')

    const stored = await getChallenge(env, challengeId)
    if (!stored || !stored.userId) return error('验证已失效，请重试')
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
    const dup = await env.DB.prepare('SELECT id FROM passkeys WHERE credential_id = ?')
      .bind(bytesToB64url(credentialID))
      .first()
    if (dup) return error('该通行密钥已被使用', 409)

    await env.DB.prepare(
      'INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, transports, created_at) VALUES (?,?,?,?,?,?,?)'
    ).bind(
      generateId(),
      stored.userId,
      bytesToB64url(credentialID),
      bytesToB64url(credentialPublicKey),
      counter,
      JSON.stringify(credential.response?.transports ?? []),
      Date.now()
    )
    await deleteChallenge(env, challengeId)
    return json({ ok: true, data: { done: true } })
  }

  return error('未知操作', 400)
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const { passkeyId } = await readJson(request)
  if (!passkeyId) return error('缺少必要参数')

  const pk = await env.DB.prepare('SELECT id, user_id FROM passkeys WHERE id = ?')
    .bind(passkeyId)
    .first()
  if (!pk || pk.user_id !== userId) return error('通行密钥不存在', 404)

  // 至少保留一种登录方式：无密码且这是最后一个通行密钥时禁止删除
  const user = await env.DB.prepare('SELECT password_hash, two_factor_enabled FROM users WHERE id = ?')
    .bind(userId)
    .first()
  const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM passkeys WHERE user_id = ?')
    .bind(userId)
    .first()
  const total = Number((count?.c as number) ?? 0)
  if (!user?.password_hash && total <= 1) {
    return error('这是你唯一的登录方式，请先设置密码后再删除', 400)
  }

  // 删除最后一个通行密钥后无法完成双重认证，自动关闭 2FA
  const batch = [env.DB.prepare('DELETE FROM passkeys WHERE id = ?').bind(passkeyId)]
  if (user?.two_factor_enabled && total <= 1) {
    batch.push(env.DB.prepare('UPDATE users SET two_factor_enabled = 0 WHERE id = ?').bind(userId))
  }
  await env.DB.batch(batch)
  return json({ ok: true, data: { done: true } })
}
