import type { ImportNode } from './types'

// 解析 Chrome / Edge 导出的 Netscape 书签 HTML 为 JSON 树
export function parseBookmarksHTML(html: string): ImportNode[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const firstDl = doc.querySelector('dl')
  if (!firstDl) throw new Error('无法解析该文件，请确认导出的是 Chrome / Edge 书签 HTML 文件')
  return parseDl(firstDl)
}

function parseDl(dl: Element): ImportNode[] {
  const nodes: ImportNode[] = []
  let currentFolder: ImportNode | null = null
  for (const el of Array.from(dl.children)) {
    const tag = el.tagName.toLowerCase()
    if (tag === 'dt') {
      const a = el.querySelector('a')
      const h3 = el.querySelector('h3')
      if (a) {
        nodes.push({
          type: 'bookmark',
          title: (a.textContent || '').trim(),
          url: a.getAttribute('href') || '',
        })
        currentFolder = null
      } else if (h3) {
        currentFolder = {
          type: 'folder',
          title: (h3.textContent || '').trim() || '未命名文件夹',
          children: [],
        }
        nodes.push(currentFolder)
      } else {
        currentFolder = null
      }
    } else if (tag === 'dl' && currentFolder && currentFolder.type === 'folder') {
      currentFolder.children = parseDl(el)
      currentFolder = null
    }
  }
  return nodes
}
