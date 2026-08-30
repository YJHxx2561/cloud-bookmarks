/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database
  AI: Ai
  AI_MODEL: string
  // 密码找回邮件发送（可选）：配置其一即可启用邮件发送，否则重置链接直接返回给前端（仅演示）
  MAIL_FROM?: string
  RESEND_API_KEY?: string
}
