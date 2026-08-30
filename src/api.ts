import type { Bookmark, BookmarkData, Folder, ImportNode, User } from './types'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) {
    const msg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as any).error)
        : `请求失败 (${res.status})`
    throw new ApiError(msg, res.status)
  }
  return data as T
}

export const api = {
  me: async (): Promise<User> => {
    const d = await request<{ ok: true; data: { user: User } }>('/api/me')
    return d.data.user
  },
  // 注册：支持 仅密码 / 仅通行密钥 / 密码+通行密钥
  // 返回 next: 'passkey'（继续通行密钥注册） | 'done'（已建立会话）
  register: (payload: {
    username: string
    password?: string
    email?: string
    setupPasskey?: boolean
    enable2fa?: boolean
  }) =>
    request<{ ok: true; data: { next: string; challengeId?: string; options?: any; user?: User } }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  registerVerify: (payload: { challengeId: string; username: string; credential: any }) =>
    request<{ ok: true; data: { user: User } }>('/api/auth/register-verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  // 密码登录：返回 next: '2fa'（需第二因素：通行密钥或验证器） | 'done'
  login: (payload: { username: string; password: string }) =>
    request<{
      ok: true
      data: {
        next: string
        methods?: { passkey: boolean; totp: boolean }
        challengeId?: string
        options?: any
        totpChallengeId?: string
        user?: User
      }
    }>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  // 2FA 第二步：验证器验证码
  loginTotp: (challengeId: string, code: string) =>
    request<{ ok: true; data: { user: User } }>('/api/auth/totp-verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId, code }),
    }),
  loginOptions: (username: string) =>
    request<{ ok: true; data: { challengeId: string; options: any } }>('/api/auth/login-options', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  loginVerify: (payload: { challengeId: string; credential: any }) =>
    request<{ ok: true; data: { user: User } }>('/api/auth/login-verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  // 找回密码 / 重置
  forgot: (username: string) =>
    request<{ ok: true; message?: string; data?: { resetLink: string } }>('/api/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ ok: true; data: { done: boolean } }>('/api/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

  // 账户设置
  account: () =>
    request<{
      ok: true
      data: {
        username: string
        email: string | null
        hasPassword: boolean
        twoFactorEnabled: boolean
        totpEnabled: boolean
        passkeys: { id: string; createdAt: number }[]
      }
    }>('/api/account'),
  toggle2FA: (enabled: boolean) =>
    request<{ ok: true; data: { enabled: boolean } }>('/api/account/2fa', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
  // TOTP 验证器绑定
  totpSetup: () =>
    request<{ ok: true; data: { secret: string; uri: string } }>('/api/account/totp', {
      method: 'POST',
      body: JSON.stringify({ step: 'setup' }),
    }),
  totpVerify: (code: string) =>
    request<{ ok: true; data: { done: boolean } }>('/api/account/totp', {
      method: 'POST',
      body: JSON.stringify({ step: 'verify', code }),
    }),
  totpDelete: () =>
    request<{ ok: true; data: { done: boolean } }>('/api/account/totp', {
      method: 'DELETE',
    }),
  updateEmail: (email: string) =>
    request<{ ok: true; data: { email: string | null } }>('/api/account', {
      method: 'PATCH',
      body: JSON.stringify({ email }),
    }),
  changePassword: (currentPassword: string | null, newPassword: string) =>
    request<{ ok: true; data: { done: boolean } }>('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  addPasskeyOptions: () =>
    request<{ ok: true; data: { challengeId: string; options: any } }>('/api/account/passkey', {
      method: 'POST',
      body: JSON.stringify({ step: 'options' }),
    }),
  addPasskeyVerify: (challengeId: string, credential: any) =>
    request<{ ok: true; data: { done: boolean } }>('/api/account/passkey', {
      method: 'POST',
      body: JSON.stringify({ step: 'verify', challengeId, credential }),
    }),
  deletePasskey: (passkeyId: string) =>
    request<{ ok: true; data: { done: boolean } }>('/api/account/passkey', {
      method: 'DELETE',
      body: JSON.stringify({ passkeyId }),
    }),

  getData: async (): Promise<BookmarkData> => {
    const d = await request<{ ok: true; data: BookmarkData }>('/api/data')
    return d.data
  },
  createFolder: (name: string, parentId: string | null) =>
    request<{ ok: true; data: { folder: Folder } }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentId }),
    }),
  updateFolder: (id: string, patch: Partial<Pick<Folder, 'name' | 'parentId'>>) =>
    request<{ ok: true; data: { folder: Folder } }>(`/api/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteFolder: (id: string) =>
    request<{ ok: true }>(`/api/folders/${id}`, { method: 'DELETE' }),

  createBookmark: (payload: {
    url: string
    title?: string
    description?: string
    aiDescription?: string
    aiEnabled?: boolean
    folderId?: string | null
  }) =>
    request<{ ok: true; data: { bookmark: Bookmark } }>('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateBookmark: (
    id: string,
    patch: Partial<Pick<Bookmark, 'url' | 'title' | 'description' | 'aiDescription' | 'folderId'>> & {
      aiEnabled?: boolean
    }
  ) =>
    request<{ ok: true; data: { bookmark: Bookmark } }>(`/api/bookmarks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteBookmark: (id: string) =>
    request<{ ok: true }>(`/api/bookmarks/${id}`, { method: 'DELETE' }),
  batchBookmarks: (action: 'delete' | 'move', ids: string[], folderId: string | null) =>
    request<{ ok: true; data: { deleted?: number; moved?: number } }>('/api/bookmarks/batch', {
      method: 'POST',
      body: JSON.stringify({ action, ids, folderId }),
    }),

  reorder: (type: 'bookmark' | 'folder', ids: string[]) =>
    request<{ ok: true }>('/api/reorder', { method: 'POST', body: JSON.stringify({ type, ids }) }),

  fetchMeta: (url: string) =>
    request<{ ok: true; data: { title: string; description: string } }>('/api/meta', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
  aiDescription: (url: string, title: string) =>
    request<{ ok: true; data: { text: string } }>('/api/ai-description', {
      method: 'POST',
      body: JSON.stringify({ url, title }),
    }),
  importTree: (tree: ImportNode[], parentId: string | null) =>
    request<{ ok: true; data: { bookmarks: number; folders: number } }>('/api/import', {
      method: 'POST',
      body: JSON.stringify({ tree, parentId }),
    }),
}
