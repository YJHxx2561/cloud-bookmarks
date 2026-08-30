import type { ImportNode } from './types'

// 解析 Chrome / Edge 导出的 Netscape 书签 HTML 为 JSON 树
//
// 注意：浏览器 DOMParser 解析 Netscape 书签文件时，会把「文件夹下的 <DL>」作为
// <DT> 的直接子节点（HTML5 列表解析规则），而不是 <DT> 的兄弟节点。因此这里只查询
// <dt> 的「直接子元素」，避免 querySelector 误命中嵌套在子收藏夹里的深层书签。
export function parseBookmarksHTML(html: string): ImportNode[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const firstDl = doc.querySelector('dl')
  if (!firstDl) throw new Error('无法解析该文件，请确认导出的是 Chrome / Edge 书签 HTML 文件')
  return parseDl(firstDl)
}

function directChild(el: Element, tag: string): Element | null {
  for (const c of Array.from(el.children)) {
    if (c.tagName.toLowerCase() === tag) return c
  }
  return null
}

function parseDl(dl: Element): ImportNode[] {
  const nodes: ImportNode[] = []
  for (const el of Array.from(dl.children)) {
    const tag = el.tagName.toLowerCase()
    if (tag !== 'dt' && tag !== 'dd') continue // 跳过 <p> 等无关节点

    // 文件夹：<dt> 直接包含 <h3>（标题）与 <dl>（子节点）
    const h3 = directChild(el, 'h3')
    if (h3) {
      const folder: ImportNode = {
        type: 'folder',
        title: (h3.textContent || '').trim() || '未命名文件夹',
        children: [],
      }
      const nested = directChild(el, 'dl')
      if (nested) folder.children = parseDl(nested)
      nodes.push(folder)
      continue
    }

    // 书签：<dt> 直接包含 <a>
    const a = directChild(el, 'a')
    if (a) {
      nodes.push({
        type: 'bookmark',
        title: (a.textContent || '').trim(),
        url: a.getAttribute('href') || '',
      })
    }
  }
  return nodes
}
