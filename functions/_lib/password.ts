// 密码哈希：PBKDF2-SHA256（基于 Web Crypto，无需额外依赖）
import { bytesToB64url, randomToken } from './helpers'

const ITERATIONS = 100_000

export async function hashPassword(password: string): Promise<string> {
  const salt = await randomToken(16)
  const hash = await derive(password, salt)
  return `pbkdf2$${salt}$${hash}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split('$')
  if (algo !== 'pbkdf2' || !salt || !hash) return false
  const derived = await derive(password, salt)
  return derived === hash
}

async function derive(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256
  )
  return bytesToB64url(new Uint8Array(bits))
}
