// 批量操作书签：action = 'delete' | 'move'
import { json, error, readJson } from '../../_lib/helpers'

const MAX_IDS = 500

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { userId } = context.data as { userId: string }
  const env = context.env
  const body = await readJson(context.request)
  const ids = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.map((x: unknown) => String(x).trim()).filter(Boolean)))
    : []
  if (ids.length === 0) return error('请选择要操作的书签')
  if (ids.length > MAX_IDS) return error(`单次最多操作 ${MAX_IDS} 个书签`)

  const action = body.action

  if (action === 'delete') {
    // 分批删除，避免 SQLite 变量数限制
    const chunkSize = 100
    let deleted = 0
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const ph = chunk.map(() => '?').join(',')
      const r = await env.DB.prepare(
        `DELETE FROM bookmarks WHERE user_id = ? AND id IN (${ph})`
      )
        .bind(userId, ...chunk)
        .run()
      deleted += Number((r.meta as { changes?: number } | undefined)?.changes ?? 0)
    }
    return json({ ok: true, data: { deleted } })
  }

  if (action === 'move') {
    const folderId =
      body.folderId === null || body.folderId === undefined || body.folderId === ''
        ? null
        : String(body.folderId)
    if (folderId) {
      const f = await env.DB.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
        .bind(folderId, userId)
        .first()
      if (!f) return error('目标文件夹不存在', 404)
    }
    const row = await env.DB.prepare(
      'SELECT COALESCE(MAX(sort), -1) AS m FROM bookmarks WHERE user_id = ? AND folder_id IS ?'
    )
      .bind(userId, folderId)
      .first()
    let sort = ((row?.m as number | undefined) ?? -1) + 1
    let moved = 0
    for (const id of ids) {
      const r = await env.DB.prepare(
        'UPDATE bookmarks SET folder_id = ?, sort = ?, updated_at = ? WHERE id = ? AND user_id = ?'
      )
        .bind(folderId, sort++, Date.now(), id, userId)
        .run()
      if (Number((r.meta as { changes?: number } | undefined)?.changes ?? 0) > 0) moved++
    }
    return json({ ok: true, data: { moved } })
  }

  return error('未知操作')
}
