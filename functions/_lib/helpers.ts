// 通用工具函数（用于所有 Pages Functions）

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function error(message: string, status = 400): Response {
  return json({ ok: false, error: message }, status)
}

export async function readJson(request: Request): Promise<any> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim()
  }
  return out
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function now(): number {
  return Date.now()
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function randomToken(bytes = 32): Promise<string> {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return bytesToB64url(arr)
}

// 从请求推导 WebAuthn 依赖方（RP）信息，兼容 pages.dev 与自定义域名、本地开发
export function getRpInfo(request: Request): { origin: string; rpID: string } {
  const url = new URL(request.url)
  return { origin: url.origin, rpID: url.hostname }
}

export function getBodyOrigin(request: Request): string | null {
  try {
    return new URL(request.url).origin
  } catch {
    return null
  }
}

// 校验 http/https 链接，防止非 http 协议
export function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u
  } catch {
    return null
  }
}

// 中间件注入的用户上下文
export interface UserData {
  userId: string
  username: string
}
