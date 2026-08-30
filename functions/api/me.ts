// 获取当前登录用户（需鉴权）
import { json } from '../_lib/helpers'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const data = context.data as { userId: string; username: string }
  return json({ ok: true, data: { user: { id: data.userId, username: data.username } } })
}
