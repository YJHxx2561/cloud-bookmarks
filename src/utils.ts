import type { Bookmark, Folder } from './types'

// 跨组件拖拽状态（同一浏览器页面内共享）
export interface DragItem {
  type: 'bookmark' | 'folder'
  id: string
}
export let dragItem: DragItem | null = null
export function setDragItem(item: DragItem | null) {
  dragItem = item
}

export function faviconFor(url: string): string {
  try {
    const u = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`
  } catch {
    return ''
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export function bySort<T extends { sort: number }>(a: T, b: T): number {
  return a.sort - b.sort
}

export function foldersByParent(folders: Folder[], parentId: string | null): Folder[] {
  return folders.filter((f) => (f.parentId ?? null) === (parentId ?? null)).sort(bySort)
}

export function bookmarksByFolder(bookmarks: Bookmark[], folderId: string | null): Bookmark[] {
  return bookmarks.filter((b) => (b.folderId ?? null) === (folderId ?? null)).sort(bySort)
}

export interface FlatFolder {
  folder: Folder
  depth: number
}

export function flattenFolders(
  folders: Folder[],
  parentId: string | null = null,
  depth = 0,
  out: FlatFolder[] = []
): FlatFolder[] {
  for (const f of foldersByParent(folders, parentId)) {
    out.push({ folder: f, depth })
    flattenFolders(folders, f.id, depth + 1, out)
  }
  return out
}

// 从当前文件夹向上回溯出面包屑路径
export function folderPath(folders: Folder[], folderId: string | null): Folder[] {
  const path: Folder[] = []
  let cur = folderId
  while (cur) {
    const f = folders.find((x) => x.id === cur)
    if (!f) break
    path.unshift(f)
    cur = f.parentId
  }
  return path
}
