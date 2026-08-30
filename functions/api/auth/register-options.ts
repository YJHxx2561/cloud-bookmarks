// 注册第一步：生成 WebAuthn 注册选项
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { json, error, readJson, generateId, getRpInfo } from '../../_lib/helpers'
import { storeChallenge } from '../../_lib/webauthn'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { username } = await readJson(request)
  const name = String(username ?? '').trim()
  if (!name || name.length < 2 || name.length > 32 || !/^[\w.\-\u4e00-\u9fa5]+$/.test(name)) {
    return error('用户名需为 2-32 位的字母、数字、下划线、点、中划线或中文')
  }
  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(name)
    .first()
  if (existing) return error('该用户名已被注册', 409)

  const userId = generateId()
  const { origin, rpID } = getRpInfo(request)
  const options = await generateRegistrationOptions({
    rpName: 'CloudFav 云收藏夹',
    rpID,
    userName: name,
    userID: userId,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })
  const challengeId = await storeChallenge(env, {
    userId,
    username: name,
    challenge: options.challenge,
    rpID,
    origin,
  })
  return json({ ok: true, data: { challengeId, options } })
}
