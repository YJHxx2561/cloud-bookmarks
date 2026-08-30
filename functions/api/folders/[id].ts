// 重命名 / 移动文件夹，删除文件夹（级联删除子文件夹与书签）
import { json, error, readJson } from '../../_lib/helpers'

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { userId } = context.data as { userId: string }
  const id = context.params.id as string
  const env = context.env
  const folder = await env.DB.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first()
  if (!folder) return error('文件夹不存在', 404)

  const body = await readJson(context.request)
  let name = folder.name as string
  let parentId: string | null = (folder.parent_id as string) ?? null
  let sort = folder.sort as number

  if (body.name !== undefined) {
    name = String(body.name ?? '').trim()
    if (!name || name.length > 200) return error('文件夹名称不能为空且不超过 200 字符')
  }

  if (body.parentId !== undefined) {
    const newParent = body.parentId === null || body.parentId === '' ? null : String(body.parentId)
    if (newParent === id) return error('不能移动到自身')
    if (newParent) {
      const p = await env.DB.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
        .bind(newParent, userId)
        .first()
      if (!p) return error('目标文件夹不存在', 404)
      // 环检测：不能移动到自身或其子文件夹内
      let cur: string | null = newParent
      while (cur) {
        if (cur === id) return error('不能移动到自身或其子文件夹内')
        const r = (await env.DB.prepare('SELECT parent_id FROM folders WHERE id = ?')
          .bind(cur)
          .first()) as { parent_id?: string | null } | null
        cur = (r?.parent_id as string) ?? null
      }
    }
    if (newParent !== parentId) {
      parentId = newParent
      const row = await env.DB.prepare(
        'SELECT COALESCE(MAX(sort), -1) AS m FROM folders WHERE user_id = ? AND parent_id IS ?'
      )
        .bind(userId, parentId)
        .first()
      sort = ((row?.m as number) ?? -1) + 1
    }
  }

  await env.DB.prepare('UPDATE folders SET name = ?, parent_id = ?, sort = ? WHERE id = ?')
    .bind(name, parentId, sort, id)
    .run()
  const updated = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(id).first()
  return json({ ok: true, data: { folder: updated } })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { userId } = context.data as { userId: string }
  const id = context.params.id as string
  const env = context.env
  const folder = await env.DB.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first()
  if (!folder) return error('文件夹不存在', 404)

  // 收集整棵子树
  const all = await env.DB.prepare('SELECT id, parent_id FROM folders WHERE user_id = ?')
    .bind(userId)
    .all()
  const childrenMap = new Map<string | null, string[]>()
  for (const f of all.results) {
    const pid = (f.parent_id as string) ?? null
    const arr = childrenMap.get(pid) ?? []
    arr.push(f.id as string)
    childrenMap.set(pid, arr)
  }
  const ids = [id]
  const queue = [id]
  while (queue.length) {
    const cur = queue.shift()!
    for (const c of childrenMap.get(cur) ?? []) {
      ids.push(c)
      queue.push(c)
    }
  }
  const placeholders = ids.map(() => '?').join(',')
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM bookmarks WHERE user_id = ? AND folder_id IN (${placeholders})`).bind(
      userId,
      ...ids
    ),
    env.DB.prepare(`DELETE FROM folders WHERE user_id = ? AND id IN (${placeholders})`).bind(
      userId,
      ...ids
    ),
  ])
  return json({ ok: true })
}
