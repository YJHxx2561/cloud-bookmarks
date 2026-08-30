// 新建书签
import { json, error, readJson, generateId, safeUrl } from '../_lib/helpers'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { userId } = context.data as { userId: string }
  const env = context.env
  const body = await readJson(context.request)
  const parsed = safeUrl(String(body.url ?? ''))
  if (!parsed) return error('请输入有效的 http/https 链接')

  const folderId = body.folderId ? String(body.folderId) : null
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
  const sort = ((row?.m as number) ?? -1) + 1
  const id = generateId()
  await env.DB.prepare(
    'INSERT INTO bookmarks (id, user_id, folder_id, url, title, description, ai_description, ai_enabled, sort, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  )
    .bind(
      id,
      userId,
      folderId,
      parsed.href,
      String(body.title ?? '').slice(0, 500),
      String(body.description ?? '').slice(0, 2000),
      String(body.aiDescription ?? '').slice(0, 2000),
      body.aiEnabled ? 1 : 0,
      sort,
      Date.now(),
      Date.now()
    )
    .run()
  const bookmark = await env.DB.prepare('SELECT * FROM bookmarks WHERE id = ?').bind(id).first()
  return json({ ok: true, data: { bookmark } }, 201)
}
