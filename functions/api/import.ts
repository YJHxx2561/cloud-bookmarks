// 批量导入 Chrome / Edge 导出的收藏夹树（Netscape HTML 格式，已在前端解析为 JSON 树）
import { json, error, readJson, generateId, safeUrl } from '../_lib/helpers'

interface ImportNode {
  type: 'folder' | 'bookmark'
  title?: string
  url?: string
  children?: ImportNode[]
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { userId } = context.data as { userId: string }
  const env = context.env
  const body = await readJson(context.request)
  const tree: ImportNode[] = Array.isArray(body.tree) ? body.tree : []
  const rootFolder = body.parentId ? String(body.parentId) : null
  if (tree.length === 0) return error('没有可导入的收藏内容')

  if (rootFolder) {
    const f = await env.DB.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
      .bind(rootFolder, userId)
      .first()
    if (!f) return error('目标文件夹不存在', 404)
  }

  const base = async (table: 'folders' | 'bookmarks') => {
    const row = await env.DB.prepare(
      `SELECT COALESCE(MAX(sort), -1) AS m FROM ${table} WHERE user_id = ? AND parent_id IS ?`
    )
      .bind(userId, rootFolder)
      .first()
    return ((row?.m as number) ?? -1) + 1
  }

  let folderSort = await base('folders')
  let bookmarkSort = await base('bookmarks')
  let folders = 0
  let bookmarks = 0

  const walk = async (nodes: ImportNode[], pid: string | null) => {
    for (const node of nodes) {
      if (node.type === 'folder') {
        const id = generateId()
        await env.DB.prepare(
          'INSERT INTO folders (id, user_id, name, parent_id, sort, created_at) VALUES (?,?,?,?,?,?)'
        )
          .bind(id, userId, String(node.title ?? '未命名文件夹').slice(0, 200), pid, folderSort++, Date.now())
          .run()
        folders++
        await walk(Array.isArray(node.children) ? node.children : [], id)
      } else if (node.type === 'bookmark' && node.url) {
        const parsed = safeUrl(String(node.url))
        if (!parsed) continue
        await env.DB.prepare(
          'INSERT INTO bookmarks (id, user_id, folder_id, url, title, description, ai_description, ai_enabled, sort, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        )
          .bind(
            generateId(),
            userId,
            pid,
            parsed.href,
            String(node.title ?? '').slice(0, 500),
            '',
            '',
            0,
            bookmarkSort++,
            Date.now(),
            Date.now()
          )
          .run()
        bookmarks++
      }
    }
  }

  await walk(tree, rootFolder)
  return json({ ok: true, data: { bookmarks, folders } })
}
