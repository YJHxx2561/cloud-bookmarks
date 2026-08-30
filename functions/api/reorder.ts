// 调整同层级的书签 / 文件夹顺序
import { json, error, readJson } from '../_lib/helpers'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { userId } = context.data as { userId: string }
  const body = await readJson(context.request)
  const type = body.type
  if (type !== 'bookmark' && type !== 'folder') return error('类型错误')
  if (!Array.isArray(body.ids)) return error('ids 必须为数组')

  const table = type === 'bookmark' ? 'bookmarks' : 'folders'
  const batch = []
  for (let i = 0; i < body.ids.length; i++) {
    batch.push(
      context.env.DB.prepare(`UPDATE ${table} SET sort = ? WHERE id = ? AND user_id = ?`).bind(
        i,
        String(body.ids[i]),
        userId
      )
    )
  }
  if (batch.length) await context.env.DB.batch(batch)
  return json({ ok: true })
}
