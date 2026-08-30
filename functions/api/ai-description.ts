// 使用 Cloudflare Workers AI 生成网站简介
import { json, error, readJson, safeUrl } from '../_lib/helpers'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await readJson(context.request)
  const url = safeUrl(String(body.url ?? ''))
  if (!url) return error('请输入有效的 http/https 链接')
  if (!context.env.AI) return error('未配置 Workers AI 绑定，请在 Cloudflare 面板中开启 AI 能力', 503)

  const model = context.env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct'
  const title = String(body.title ?? '').slice(0, 300)
  const prompt = `你是一名专业的网站简介撰写助手。请根据下面的网站标题和网址，用中文为它写一段 40-80 字的简介。要求：语言简洁、客观、信息准确；不要编造网站并不具备的功能；不要出现“根据标题”“无法确定”“很抱歉”等字样；直接输出简介内容，不要加引号或多余前缀。\n\n网站标题：${title}\n网址：${url.href}\n\n简介：`

  try {
    const result: any = await context.env.AI.run(model, {
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (result?.response ?? result?.text ?? '').trim()
    if (!text) return error('AI 未返回内容，请重试', 502)
    return json({ ok: true, data: { text: text.slice(0, 2000) } })
  } catch (e: any) {
    return error('AI 生成失败：' + (e?.message ?? '未知错误'), 502)
  }
}
