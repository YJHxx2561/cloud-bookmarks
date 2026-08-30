// 注册：支持 仅密码 / 仅通行密钥 / 密码+通行密钥（2FA）三种方式
// 返回 next:
//   - 'passkey': 需要继续完成通行密钥注册（调 register-verify）
//   - 'done':    注册完成，已建立会话（仅密码注册）
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { json, error, readJson, generateId, getRpInfo } from '../../_lib/helpers'
import { hashPassword } from '../../_lib/password'
import { storeChallenge } from '../../_lib/webauthn'
import { createSessionResponse } from '../../_lib/auth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { username, password, email, setupPasskey } = await readJson(request)
  const name = String(username ?? '').trim()
  const pw = typeof password === 'string' ? password : ''
  const em = typeof email === 'string' ? email.trim() : ''
  const hasPasskey = Boolean(setupPasskey)

  if (!name || name.length < 2 || name.length > 32 || !/^[\w.\-\u4e00-\u9fa5]+$/.test(name)) {
    return error('用户名需为 2-32 位的字母、数字、下划线、点、中划线或中文')
  }
  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(name)
    .first()
  if (existing) return error('该用户名已被注册', 409)

  // 至少启用一种登录方式
  if (!pw && !hasPasskey) return error('请设置密码或启用通行密钥')
  if (pw && pw.length < 8) return error('密码至少需要 8 位')
  if (em && !EMAIL_RE.test(em)) return error('邮箱格式不正确')

  let userId: string | null = null
  if (pw) {
    userId = generateId()
    const hash = await hashPassword(pw)
    await env.DB.prepare(
      'INSERT INTO users (id, username, password_hash, email, created_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(userId, name, hash, em || null, Date.now())
      .run()
  }

  if (hasPasskey) {
    // 预生成 userId（含仅通行密钥注册），写入挑战，由 register-verify 创建用户或补挂凭据
    const pendingUserId = userId || generateId()
    const { origin, rpID } = getRpInfo(request)
    const options = await generateRegistrationOptions({
      rpName: 'CloudFav 云收藏夹',
      rpID,
      userName: name,
      userID: pendingUserId,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    })
    const challengeId = await storeChallenge(env, {
      userId: pendingUserId,
      username: name,
      challenge: options.challenge,
      rpID,
      origin,
    })
    return json({ ok: true, data: { next: 'passkey', challengeId, options } })
  }

  return createSessionResponse(env, request, userId as string, {
    ok: true,
    data: { next: 'done', user: { id: userId, username: name } },
  })
}
