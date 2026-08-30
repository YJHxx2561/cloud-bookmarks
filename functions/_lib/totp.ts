// TOTP（基于时间的一次性密码，RFC 6238 / RFC 4226）工具
// 用于绑定验证器应用（Google Authenticator、Authy、1Password 等）
// 算法：HMAC-SHA1、6 位数字、30 秒周期，支持前后各 1 个时间窗的容差

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(input: string): Uint8Array {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

// 生成 20 字节随机密钥（160 位），base32 编码后约 32 字符
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return base32Encode(bytes)
}

async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const keyBuf = await crypto.subtle.importKey(
    'raw',
    key as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', keyBuf, data as unknown as BufferSource)
  return new Uint8Array(sig)
}

async function totpAt(secret: string, counter: number): Promise<string> {
  const key = base32Decode(secret)
  const msg = new Uint8Array(8)
  let c = counter
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff
    c = Math.floor(c / 256)
  }
  const h = await hmacSha1(key, msg)
  const off = h[h.length - 1] & 0x0f
  const code =
    ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]
  return String(code % 1000000).padStart(6, '0')
}

export async function verifyTotp(secret: string, code: string, window = 1): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false
  const counter = Math.floor(Date.now() / 1000 / 30)
  for (let i = -window; i <= window; i++) {
    const expected = await totpAt(secret, counter + i)
    if (expected === code) return true
  }
  return false
}

// 生成 otpauth:// URI，供验证器应用扫码 / 手动添加
export function buildOtpauthUri(secret: string, account: string, issuer = 'CloudFav'): string {
  const label = `${issuer}:${account}`
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
}
