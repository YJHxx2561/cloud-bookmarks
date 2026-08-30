// 会话管理：基于 HttpOnly Cookie + D1 存储的登录会话

import { json, parseCookies, randomToken, sha256Hex } from './helpers'

const SESSION_COOKIE = 'cloudfav_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 天

export async function getSessionUser(
  request: Request,
  env: Env
): Promise<{ id: string; username: string } | null> {
  const cookies = parseCookies(request.headers.get('Cookie'))
  const token = cookies[SESSION_COOKIE]
  if (!token) return null
  const hash = await sha256Hex(token)
  const row = await env.DB.prepare(
    `SELECT u.id, u.username FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(hash, Date.now())
    .first()
  if (!row) return null
  return { id: row.id as string, username: row.username as string }
}

export async function createSession(env: Env, userId: string): Promise<string> {
  const token = await randomToken(32)
  const hash = await sha256Hex(token)
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  )
    .bind(hash, userId, Date.now(), Date.now() + SESSION_TTL_MS)
    .run()
  return token
}

// 创建会话并以 JSON + Set-Cookie 返回响应（登录/注册成功后使用）
export async function createSessionResponse(
  env: Env,
  request: Request,
  userId: string,
  body: unknown
): Promise<Response> {
  const token = await createSession(env, userId)
  return withSession(json(body), sessionCookieHeaders(token, request))
}

export async function destroySession(request: Request, env: Env): Promise<void> {
  const cookies = parseCookies(request.headers.get('Cookie'))
  const token = cookies[SESSION_COOKIE]
  if (!token) return
  const hash = await sha256Hex(token)
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run()
}

export function sessionCookieHeaders(token: string, request: Request): Headers {
  const headers = new Headers()
  const url = new URL(request.url)
  const secure = url.protocol === 'https:'
  headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${
      secure ? '; Secure' : ''
    }; Max-Age=${SESSION_TTL_MS / 1000}`
  )
  return headers
}

export function clearSessionCookieHeaders(request: Request): Headers {
  const headers = new Headers()
  const url = new URL(request.url)
  const secure = url.protocol === 'https:'
  headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=0`
  )
  return headers
}

export function withSession(jsonResponse: Response, headers: Headers): Response {
  const res = new Response(jsonResponse.body, jsonResponse)
  headers.forEach((v, k) => res.headers.append(k, v))
  return res
}
