import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bookmark as BookmarkIcon,
  ChevronRight,
  FolderPlus,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sun,
  Upload,
  X,
} from 'lucide-react'
import { api } from '../api'
import { parseBookmarksHTML } from '../import'
import {
  bookmarksByFolder,
  dragItem,
  folderPath,
  foldersByParent,
  setDragItem,
} from '../utils'
import { Button } from './ui'
import { BookmarkModal, ConfirmDialog, FolderModal } from './modals'
import SettingsModal from './SettingsModal'
import Sidebar from './Sidebar'
import BookmarkList from './BookmarkList'
import { toast, toastError } from './Toasts'
import type { Bookmark, BookmarkData, Folder, User } from '../types'

type ModalState =
  | { kind: 'bookmark'; mode: 'create'; folderId: string | null }
  | { kind: 'bookmark'; mode: 'edit'; bookmark: Bookmark }
  | { kind: 'folder'; mode: 'create'; parentId: string | null }
  | { kind: 'folder'; mode: 'edit'; folder: Folder }
  | null

type ConfirmState = {
  title: string
  message: string
  onConfirm: () => Promise<void> | void
}

export default function Main({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [data, setData] = useState<BookmarkData | null>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('cf-theme') === 'dark')
  const [modal, setModal] = useState<ModalState>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const folders = data?.folders ?? []
  const bookmarks = data?.bookmarks ?? []

  // ---------- 主题 ----------
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('cf-theme', dark ? 'dark' : 'light')
  }, [dark])

  // ---------- 数据 ----------
  const refresh = useCallback(async () => {
    const d = await api.getData()
    setData(d)
  }, [])

  useEffect(() => {
    refresh().catch(toastError)
  }, [refresh])

  const isSearch = search.trim().length > 0
  const q = search.trim().toLowerCase()
  const searchBookmarks = isSearch
    ? bookmarks.filter((b) =>
        [b.title, b.url, b.description, b.aiDescription].join(' ').toLowerCase().includes(q)
      )
    : []
  const searchFolders = isSearch ? folders.filter((f) => f.name.toLowerCase().includes(q)) : []
  const subfolders = isSearch ? [] : foldersByParent(folders, currentFolderId)
  const currentBookmarks = isSearch ? [] : bookmarksByFolder(bookmarks, currentFolderId)
  const path = folderPath(folders, currentFolderId)
  const isEmpty = !isSearch && subfolders.length === 0 && currentBookmarks.length === 0

  // ---------- 拖拽 ----------
  const handleDrop = async (folderId: string | null, index?: number) => {
    const d = dragItem
    if (!d) return
    setDragItem(null)
    try {
      if (d.type === 'bookmark') await moveBookmark(d.id, folderId, index)
      else await moveFolder(d.id, folderId)
    } catch (e) {
      toastError(e)
    }
  }

  const moveBookmark = async (id: string, targetFolder: string | null, index?: number) => {
    const drag = bookmarks.find((b) => b.id === id)
    if (!drag) return
    const dst = targetFolder ?? null
    if ((drag.folderId ?? null) !== dst) {
      await api.updateBookmark(id, { folderId: dst })
    }
    let list = bookmarks
      .filter((b) => (b.folderId ?? null) === dst && b.id !== id)
      .sort(bySort2)
    let at = index ?? list.length
    at = Math.max(0, Math.min(at, list.length))
    const ordered = [...list.slice(0, at), { ...drag, folderId: dst }, ...list.slice(at)].map(
      (b) => b.id
    )
    await api.reorder('bookmark', ordered)
    await refresh()
  }

  const moveFolder = async (id: string, targetFolder: string | null) => {
    const drag = folders.find((f) => f.id === id)
    if (!drag) return
    const dst = targetFolder ?? null
    if ((drag.parentId ?? null) === dst) {
      const list = folders
        .filter((f) => (f.parentId ?? null) === dst && f.id !== id)
        .sort(bySort2)
      list.push(drag)
      await api.reorder('folder', list.map((f) => f.id))
    } else {
      await api.updateFolder(id, { parentId: dst })
    }
    await refresh()
  }

  const inSubtree = (id: string | null, rootId: string): boolean => {
    let cur = id
    while (cur) {
      if (cur === rootId) return true
      const f = folders.find((x) => x.id === cur)
      cur = f?.parentId ?? null
    }
    return false
  }

  // ---------- 删除 ----------
  const askDeleteBookmark = (b: Bookmark) =>
    setConfirm({
      title: '删除书签',
      message: `确定删除「${b.title || b.url}」吗？`,
      onConfirm: async () => {
        await api.deleteBookmark(b.id)
        await refresh()
        toast('书签已删除', 'success')
      },
    })

  const askDeleteFolder = (f: Folder) => {
    const wasCurrent = inSubtree(currentFolderId, f.id)
    setConfirm({
      title: '删除文件夹',
      message: `确定删除「${f.name}」吗？其内部所有子文件夹与书签都会一并删除，此操作无法恢复。`,
      onConfirm: async () => {
        await api.deleteFolder(f.id)
        await refresh()
        if (wasCurrent) setCurrentFolderId(f.parentId)
        toast('文件夹已删除', 'success')
      },
    })
  }

  // ---------- 导入 ----------
  const onPickFile = () => fileRef.current?.click()

  const handleImportFile = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      const tree = parseBookmarksHTML(text)
      const res = await api.importTree(tree, currentFolderId)
      toast(`导入成功：${res.data.folders} 个文件夹、${res.data.bookmarks} 个书签`, 'success')
      await refresh()
    } catch (e) {
      toastError(e)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const logout = async () => {
    await api.logout().catch(() => {})
    onLogout()
  }

  const openCreateBookmark = () =>
    setModal({ kind: 'bookmark', mode: 'create', folderId: currentFolderId })
  const openCreateFolder = () =>
    setModal({ kind: 'folder', mode: 'create', parentId: currentFolderId })

  return (
    <div className="flex h-screen flex-col bg-slate-100 dark:bg-slate-950">
      {/* 顶栏 */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/85 px-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85 sm:px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          <BookmarkIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="hidden sm:inline">CloudFav</span>
        </div>

        <div className="mx-1 max-w-xl flex-1 sm:mx-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题、链接、简介…"
              className="w-full rounded-full border border-slate-200 bg-slate-100/70 py-1.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800/70 dark:focus:bg-slate-800"
            />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button
            variant="secondary"
            className="!px-2.5 !py-1.5 text-xs sm:!px-3 sm:!py-2 sm:text-sm"
            onClick={onPickFile}
            loading={importing}
          >
            <Upload className="h-4 w-4" /> <span className="hidden sm:inline">导入</span>
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm,text/html"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleImportFile(f)
            }}
          />
          <button
            onClick={() => setDark((v) => !v)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title="切换主题"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title="账户设置"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
          <div className="ml-1 hidden items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-3 dark:bg-slate-800 sm:flex">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="max-w-[8rem] truncate text-sm text-slate-600 dark:text-slate-300">
              {user.username}
            </span>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-500 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 桌面侧栏 */}
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:block">
          <Sidebar
            folders={folders}
            bookmarks={bookmarks}
            currentFolderId={currentFolderId}
            onSelect={setCurrentFolderId}
            onNewFolder={(pid) => setModal({ kind: 'folder', mode: 'create', parentId: pid })}
            onEditFolder={(f) => setModal({ kind: 'folder', mode: 'edit', folder: f })}
            onDeleteFolder={askDeleteFolder}
            onDrop={handleDrop}
          />
        </aside>

        {/* 移动端抽屉 */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col bg-white shadow-2xl animate-fade-in dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <span className="font-semibold">文件夹</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <Sidebar
                  folders={folders}
                  bookmarks={bookmarks}
                  currentFolderId={currentFolderId}
                  onSelect={setCurrentFolderId}
                  onNewFolder={(pid) => setModal({ kind: 'folder', mode: 'create', parentId: pid })}
                  onEditFolder={(f) => setModal({ kind: 'folder', mode: 'edit', folder: f })}
                  onDeleteFolder={askDeleteFolder}
                  onDrop={handleDrop}
                  onClose={() => setSidebarOpen(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* 主内容 */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white/60 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
            <button
              onClick={() => {
                setCurrentFolderId(null)
                setSearch('')
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
            >
              <BookmarkIcon className="h-3.5 w-3.5" />
              全部收藏
            </button>
            {path.map((f) => (
              <span key={f.id} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                <button
                  onClick={() => setCurrentFolderId(f.id)}
                  className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                >
                  {f.name}
                </button>
              </span>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="secondary"
                className="!px-2.5 !py-1.5 text-xs"
                onClick={openCreateFolder}
              >
                <FolderPlus className="h-4 w-4" /> 新建文件夹
              </Button>
              <Button className="!px-2.5 !py-1.5 text-xs" onClick={openCreateBookmark}>
                <Plus className="h-4 w-4" /> 新建书签
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <BookmarkList
              folders={isSearch ? searchFolders : subfolders}
              bookmarks={isSearch ? searchBookmarks : currentBookmarks}
              currentFolderId={currentFolderId}
              isSearch={isSearch}
              isEmpty={isEmpty}
              onFolderOpen={(id) => {
                setCurrentFolderId(id)
                setSearch('')
              }}
              onNewBookmark={openCreateBookmark}
              onNewFolder={openCreateFolder}
              onEditFolder={(f) => setModal({ kind: 'folder', mode: 'edit', folder: f })}
              onDeleteFolder={askDeleteFolder}
              onEditBookmark={(b) => setModal({ kind: 'bookmark', mode: 'edit', bookmark: b })}
              onDeleteBookmark={askDeleteBookmark}
              onDrop={handleDrop}
            />
          </div>
        </main>
      </div>

      {/* 弹窗 */}
      <BookmarkModal
        open={modal?.kind === 'bookmark'}
        bookmark={modal?.kind === 'bookmark' && modal.mode === 'edit' ? modal.bookmark : null}
        defaultFolderId={modal?.kind === 'bookmark' && modal.mode === 'create' ? modal.folderId : null}
        folders={folders}
        onClose={() => setModal(null)}
        onSaved={refresh}
      />
      <FolderModal
        open={modal?.kind === 'folder'}
        folder={modal?.kind === 'folder' && modal.mode === 'edit' ? modal.folder : null}
        defaultParentId={modal?.kind === 'folder' && modal.mode === 'create' ? modal.parentId : null}
        folders={folders}
        onClose={() => setModal(null)}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        onConfirm={confirm?.onConfirm ?? (() => {})}
        onClose={() => setConfirm(null)}
      />
      <SettingsModal open={settingsOpen} user={user} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function bySort2<T extends { sort: number }>(a: T, b: T): number {
  return a.sort - b.sort
}
