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
  registerOptions: (username: string) =>
    request<{ ok: true; data: { challengeId: string; options: any } }>('/api/auth/register-options', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  registerVerify: (payload: { challengeId: string; username: string; credential: any }) =>
    request<{ ok: true; data: { user: User } }>('/api/auth/register-verify', {
      method: 'POST',
      body: JSON.stringify(payload),
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
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

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
