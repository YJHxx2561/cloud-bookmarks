// 编辑 / 删除书签
import { json, error, readJson, safeUrl } from '../../_lib/helpers'

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { userId } = context.data as { userId: string }
  const id = context.params.id as string
  const env = context.env
  const bm = await env.DB.prepare('SELECT * FROM bookmarks WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first()
  if (!bm) return error('书签不存在', 404)

  const body = await readJson(context.request)
  let url = bm.url as string
  let title = bm.title as string
  let description = bm.description as string
  let aiDescription = bm.ai_description as string
  let aiEnabled = bm.ai_enabled as number
  let folderId: string | null = (bm.folder_id as string) ?? null
  let sort = bm.sort as number

  if (body.url !== undefined) {
    const p = safeUrl(String(body.url ?? ''))
    if (!p) return error('请输入有效的 http/https 链接')
    url = p.href
  }
  if (body.title !== undefined) title = String(body.title ?? '').slice(0, 500)
  if (body.description !== undefined) description = String(body.description ?? '').slice(0, 2000)
  if (body.aiDescription !== undefined)
    aiDescription = String(body.aiDescription ?? '').slice(0, 2000)
  if (body.aiEnabled !== undefined) aiEnabled = body.aiEnabled ? 1 : 0

  if (body.folderId !== undefined) {
    const nf = body.folderId === null || body.folderId === '' ? null : String(body.folderId)
    if (nf) {
      const f = await env.DB.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
        .bind(nf, userId)
        .first()
      if (!f) return error('目标文件夹不存在', 404)
    }
    if (nf !== folderId) {
      folderId = nf
      const row = await env.DB.prepare(
        'SELECT COALESCE(MAX(sort), -1) AS m FROM bookmarks WHERE user_id = ? AND folder_id IS ?'
      )
        .bind(userId, folderId)
        .first()
      sort = ((row?.m as number) ?? -1) + 1
    }
  }

  await env.DB.prepare(
    'UPDATE bookmarks SET url = ?, title = ?, description = ?, ai_description = ?, ai_enabled = ?, folder_id = ?, sort = ?, updated_at = ? WHERE id = ?'
  )
    .bind(url, title, description, aiDescription, aiEnabled, folderId, sort, Date.now(), id)
    .run()
  const updated = await env.DB.prepare('SELECT * FROM bookmarks WHERE id = ?').bind(id).first()
  return json({ ok: true, data: { bookmark: updated } })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { userId } = context.data as { userId: string }
  const id = context.params.id as string
  await context.env.DB.prepare('DELETE FROM bookmarks WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()
  return json({ ok: true })
}
