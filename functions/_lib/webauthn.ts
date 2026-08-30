// WebAuthn 挑战存储：注册/登录过程中临时保存 challenge 及相关上下文

export interface StoredChallenge {
  id: string
  userId: string | null
  username: string | null
  payload: string
  createdAt: number
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000 // 5 分钟

export async function storeChallenge(
  env: Env,
  data: {
    userId?: string
    username?: string
    challenge: string
    rpID: string
    origin: string
  }
): Promise<string> {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT INTO webauthn_challenges (id, user_id, username, payload, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(
      id,
      data.userId ?? null,
      data.username ?? null,
      JSON.stringify({ challenge: data.challenge, rpID: data.rpID, origin: data.origin }),
      Date.now()
    )
    .run()
  return id
}

export async function getChallenge(env: Env, id: string): Promise<StoredChallenge | null> {
  const row = await env.DB.prepare('SELECT * FROM webauthn_challenges WHERE id = ?').bind(id).first()
  if (!row) return null
  if (Date.now() - (row.created_at as number) > CHALLENGE_TTL_MS) return null
  return {
    id: row.id as string,
    userId: (row.user_id as string) ?? null,
    username: (row.username as string) ?? null,
    payload: row.payload as string,
    createdAt: row.created_at as number,
  }
}

export async function deleteChallenge(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM webauthn_challenges WHERE id = ?').bind(id).run()
}
