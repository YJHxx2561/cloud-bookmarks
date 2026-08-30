// 邮件发送：优先 Resend（RESEND_API_KEY），其次 MailChannels（MAIL_FROM，免费）
// 两者都未配置时返回 false，调用方降级为直接返回重置链接（仅用于本地/演示）。

export function isMailConfigured(env: Env): boolean {
  return Boolean(env.MAIL_FROM || env.RESEND_API_KEY)
}

export async function sendMail(
  env: Env,
  to: string,
  subject: string,
  text: string
): Promise<boolean> {
  if (env.RESEND_API_KEY) {
    const from = env.MAIL_FROM || 'CloudFav <onboarding@resend.dev>'
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text }),
    })
    return res.ok
  }
  if (env.MAIL_FROM) {
    // MailChannels 免费发送：需先为发件域名配置 SPF/DKIM 记录
    const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: env.MAIL_FROM },
        subject,
        content: [{ type: 'text/plain', value: text }],
      }),
    })
    return res.ok
  }
  return false
}
