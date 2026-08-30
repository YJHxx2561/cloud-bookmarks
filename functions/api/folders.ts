// 创建文件夹
import { json, error, readJson, generateId } from '../_lib/helpers'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { userId } = context.data as { userId: string }
  const body = await readJson(context.request)
  const name = String(body.name ?? '').trim()
  if (!name || name.length > 200) return error('文件夹名称不能为空且不超过 200 字符')
  const parentId = body.parentId ? String(body.parentId) : null

  if (parentId) {
    const parent = await context.env.DB.prepare(
      'SELECT id FROM folders WHERE id = ? AND user_id = ?'
    )
      .bind(parentId, userId)
      .first()
    if (!parent) return error('父文件夹不存在', 404)
  }

  const row = await context.env.DB.prepare(
    'SELECT COALESCE(MAX(sort), -1) AS m FROM folders WHERE user_id = ? AND parent_id IS ?'
  )
    .bind(userId, parentId)
    .first()
  const sort = ((row?.m as number) ?? -1) + 1
  const id = generateId()
  await context.env.DB.prepare(
    'INSERT INTO folders (id, user_id, name, parent_id, sort, created_at) VALUES (?,?,?,?,?,?)'
  )
    .bind(id, userId, name, parentId, sort, Date.now())
    .run()
  const folder = await context.env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(id).first()
  return json({ ok: true, data: { folder } }, 201)
}
