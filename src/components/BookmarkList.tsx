import { FolderOpen, Pencil, Plus, SearchX, Trash2, BookmarkPlus } from 'lucide-react'
import BookmarkCard from './BookmarkCard'
import { setDragItem } from '../utils'
import type { Bookmark, Folder } from '../types'

function FolderCard({
  folder,
  onOpen,
  onEdit,
  onDelete,
  onDrop,
}: {
  folder: Folder
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onDrop: () => void
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        setDragItem({ type: 'folder', id: folder.id })
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={() => setDragItem(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDrop()
      }}
      onClick={onOpen}
      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-700"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
        <FolderOpen className="h-5 w-5" />
      </div>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
        {folder.name}
      </span>
      <div className="flex shrink-0 gap-0.5 transition sm:opacity-0 sm:group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
          title="编辑"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function BookmarkList({
  folders,
  bookmarks,
  currentFolderId,
  isSearch,
  isEmpty,
  onFolderOpen,
  onNewBookmark,
  onNewFolder,
  onEditFolder,
  onDeleteFolder,
  onEditBookmark,
  onDeleteBookmark,
  onDrop,
}: {
  folders: Folder[]
  bookmarks: Bookmark[]
  currentFolderId: string | null
  isSearch: boolean
  isEmpty: boolean
  onFolderOpen: (id: string) => void
  onNewBookmark: () => void
  onNewFolder: () => void
  onEditFolder: (f: Folder) => void
  onDeleteFolder: (f: Folder) => void
  onEditBookmark: (b: Bookmark) => void
  onDeleteBookmark: (b: Bookmark) => void
  onDrop: (folderId: string | null, index?: number) => void
}) {
  return (
    <div
      className="flex-1"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(currentFolderId)
      }}
    >
      {folders.length > 0 && (
        <>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            文件夹
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {folders.map((f) => (
              <FolderCard
                key={f.id}
                folder={f}
                onOpen={() => onFolderOpen(f.id)}
                onEdit={() => onEditFolder(f)}
                onDelete={() => onDeleteFolder(f)}
                onDrop={() => onDrop(f.id)}
              />
            ))}
          </div>
        </>
      )}

      {bookmarks.length > 0 && (
        <div className={folders.length > 0 ? 'mt-6' : ''}>
          {!isSearch && (
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              书签
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bookmarks.map((b, i) => (
              <BookmarkCard
                key={b.id}
                bookmark={b}
                index={i}
                onEdit={() => onEditBookmark(b)}
                onDelete={() => onDeleteBookmark(b)}
                onDrop={(folderId, index) => onDrop(folderId, index)}
              />
            ))}
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center dark:border-slate-700">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
            <BookmarkPlus className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-600 dark:text-slate-200">
            {isSearch ? '未找到匹配的书签' : '这里还没有内容'}
          </h3>
          <p className="mt-1 max-w-xs text-sm text-slate-400">
            {isSearch
              ? '换个关键词试试，搜索会匹配标题、链接与简介'
              : '添加第一个书签，或从 Chrome / Edge 导入收藏夹'}
          </p>
          <div className="mt-5 flex gap-2">
            {isSearch ? (
              <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-400 dark:bg-slate-800">
                <SearchX className="h-4 w-4" /> 暂无结果
              </div>
            ) : (
              <>
                <button
                  onClick={onNewBookmark}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  <Plus className="h-4 w-4" /> 新建书签
                </button>
                <button
                  onClick={onNewFolder}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700"
                >
                  <FolderOpen className="h-4 w-4" /> 新建文件夹
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
