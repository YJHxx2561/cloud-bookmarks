// 获取当前用户全部数据（文件夹 + 书签）
import { json } from '../_lib/helpers'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const data = context.data as { userId: string }
  const folders = await context.env.DB.prepare(
    'SELECT * FROM folders WHERE user_id = ? ORDER BY sort ASC, created_at ASC'
  )
    .bind(data.userId)
    .all()
  const bookmarks = await context.env.DB.prepare(
    'SELECT * FROM bookmarks WHERE user_id = ? ORDER BY sort ASC, created_at ASC'
  )
    .bind(data.userId)
    .all()
  return json({ ok: true, data: { folders: folders.results, bookmarks: bookmarks.results } })
}
