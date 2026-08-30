// 退出登录：删除会话并清除 Cookie
import { json } from '../../_lib/helpers'
import { destroySession, clearSessionCookieHeaders, withSession } from '../../_lib/auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await destroySession(request, env)
  return withSession(json({ ok: true }), clearSessionCookieHeaders(request))
}
