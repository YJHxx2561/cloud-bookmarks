export interface User {
  id: string
  username: string
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  sort: number
  createdAt: number
}

export interface Bookmark {
  id: string
  url: string
  title: string
  description: string
  aiDescription: string
  aiEnabled: number
  folderId: string | null
  sort: number
  createdAt: number
  updatedAt: number
}

export interface BookmarkData {
  folders: Folder[]
  bookmarks: Bookmark[]
}

export type ImportNode =
  | { type: 'folder'; title: string; children: ImportNode[] }
  | { type: 'bookmark'; title: string; url: string }
