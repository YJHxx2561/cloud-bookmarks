// 所有 /api/* 请求的统一中间件：校验登录会话（/api/auth/* 除外）
import { getSessionUser } from '../_lib/auth'
import { error } from '../_lib/helpers'

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  if (url.pathname.startsWith('/api/auth/')) {
    return context.next()
  }
  const user = await getSessionUser(context.request, context.env)
  if (!user) {
    return error('未登录或会话已过期，请重新登录', 401)
  }
  context.data.userId = user.id
  context.data.username = user.username
  return context.next()
}
