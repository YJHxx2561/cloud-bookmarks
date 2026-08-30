// 抓取网页标题与描述（用于新建书签时自动填充）
import { json, error, readJson, safeUrl } from '../_lib/helpers'

const BAD_HOST_RE =
  /(^localhost$)|(^127\.)|(^0\.0\.0\.0$)|(^10\.)|(^192\.168\.)|(^169\.254\.)|(^172\.(1[6-9]|2\d|3[01])\.)|(\.local$)|(^::1$)|(^\[::1\]$)/i

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { url } = await readJson(context.request)
  const parsed = safeUrl(String(url ?? ''))
  if (!parsed) return error('请输入有效的 http/https 链接')
  if (BAD_HOST_RE.test(parsed.hostname)) return error('不允许访问内网或本地地址')

  let html = ''
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(parsed.href, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return json({ ok: true, data: { title: '', description: '' } })
    const buf = await res.arrayBuffer()
    html = new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, 512 * 1024))
  } catch {
    return json({ ok: true, data: { title: '', description: '' } })
  }

  const title = extractTag(html, 'title') || extractMeta(html, 'og:title')
  const description = extractMeta(html, 'description') || extractMeta(html, 'og:description')
  return json({ ok: true, data: { title, description } })
}

function extractTag(html: string, tag: string): string {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? decodeEntities(m[1].trim().slice(0, 300)) : ''
}

function extractMeta(html: string, name: string): string {
  const re = /<meta[^>]*>/gi
  let m
  while ((m = re.exec(html))) {
    const attrs = m[0]
    const key = attrs.match(/(?:name|property)\s*=\s*["']([^"']*)["']/i)
    if (key && key[1].toLowerCase() === name.toLowerCase()) {
      const content = attrs.match(/content\s*=\s*["']([^"']*)["']/i)
      if (content) return decodeEntities(content[1].trim().slice(0, 500))
    }
  }
  return ''
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
