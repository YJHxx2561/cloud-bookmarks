import { useEffect, useMemo, useState } from 'react'
import {
  Bookmark,
  ChevronRight,
  Folder as FolderIcon,
  FolderPlus,
  Pencil,
  Trash2,
} from 'lucide-react'
import { foldersByParent, setDragItem } from '../utils'
import type { Bookmark as BookmarkType, Folder } from '../types'

function computeCounts(folders: Folder[], bookmarks: BookmarkType[]): Map<string, number> {
  const map = new Map<string, number>()
  const direct = new Map<string | null, number>()
  for (const b of bookmarks) {
    const k = b.folderId ?? null
    direct.set(k, (direct.get(k) ?? 0) + 1)
  }
  const walk = (id: string): number => {
    let total = direct.get(id) ?? 0
    for (const f of folders) if (f.parentId === id) total += walk(f.id)
    map.set(id, total)
    return total
  }
  for (const f of folders) if (f.parentId === null) walk(f.id)
  return map
}

interface TreeProps {
  folder: Folder
  depth: number
  folders: Folder[]
  expanded: Set<string>
  counts: Map<string, number>
  selected: string | null
  onToggle: (id: string) => void
  onSelect: (id: string | null) => void
  onEdit: (f: Folder) => void
  onDelete: (f: Folder) => void
  onDrop: (folderId: string | null) => void
}

function TreeNode({
  folder,
  depth,
  folders,
  expanded,
  counts,
  selected,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
  onDrop,
}: TreeProps) {
  const children = foldersByParent(folders, folder.id)
  const isOpen = expanded.has(folder.id)
  const count = counts.get(folder.id) ?? 0
  const active = selected === folder.id

  return (
    <div>
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
          onDrop(folder.id)
        }}
        onClick={() => {
          onSelect(folder.id)
          if (children.length > 0) onToggle(folder.id)
        }}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={`group flex w-full cursor-pointer items-center gap-1.5 rounded-lg py-1.5 pr-2 text-sm transition ${
          active
            ? 'bg-indigo-50 font-medium text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (children.length > 0) onToggle(folder.id)
          }}
          className={`shrink-0 rounded p-0.5 text-slate-400 transition-transform ${
            isOpen ? 'rotate-90' : ''
          } ${children.length === 0 ? 'invisible' : ''}`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <FolderIcon
          className={`h-4 w-4 shrink-0 ${
            active ? 'text-indigo-500 dark:text-indigo-300' : 'text-amber-500'
          }`}
        />
        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
        {count > 0 && (
          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] leading-none text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {count}
          </span>
        )}
        <div className="flex shrink-0 gap-0 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(folder)
            }}
            className="rounded p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            title="编辑"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(folder)
            }}
            className="rounded p-0.5 text-slate-400 hover:text-rose-500"
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {isOpen &&
        children.map((c) => (
          <TreeNode
            key={c.id}
            folder={c}
            depth={depth + 1}
            folders={folders}
            expanded={expanded}
            counts={counts}
            selected={selected}
            onToggle={onToggle}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
            onDrop={onDrop}
          />
        ))}
    </div>
  )
}

export default function Sidebar({
  folders,
  bookmarks,
  currentFolderId,
  onSelect,
  onNewFolder,
  onEditFolder,
  onDeleteFolder,
  onDrop,
  onClose,
}: {
  folders: Folder[]
  bookmarks: BookmarkType[]
  currentFolderId: string | null
  onSelect: (id: string | null) => void
  onNewFolder: (parentId: string | null) => void
  onEditFolder: (f: Folder) => void
  onDeleteFolder: (f: Folder) => void
  onDrop: (folderId: string | null) => void
  onClose?: () => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(folders.filter((f) => f.parentId === null).map((f) => f.id))
  )
  const counts = useMemo(() => computeCounts(folders, bookmarks), [folders, bookmarks])
  const rootChildren = foldersByParent(folders, null)

  // 自动展开当前所在路径
  useEffect(() => {
    if (!currentFolderId) return
    setExpanded((prev) => {
      const next = new Set(prev)
      let cur: string | null = currentFolderId
      while (cur) {
        next.add(cur)
        const f = folders.find((x) => x.id === cur)
        cur = f?.parentId ?? null
      }
      return next
    })
  }, [currentFolderId, folders])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className="flex h-full flex-col">
      <div className="p-3 pb-1">
        <button
          onClick={() => {
            onSelect(null)
            onClose?.()
          }}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            currentFolderId === null
              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Bookmark className="h-4 w-4" />
          <span className="flex-1 text-left">全部收藏</span>
          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] leading-none text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {bookmarks.length}
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {rootChildren.length === 0 ? (
          <p className="px-3 py-2 text-xs leading-relaxed text-slate-400">
            暂无文件夹，可点击下方「新建文件夹」整理书签。
          </p>
        ) : (
          rootChildren.map((f) => (
            <TreeNode
              key={f.id}
              folder={f}
              depth={0}
              folders={folders}
              expanded={expanded}
              counts={counts}
              selected={currentFolderId}
              onToggle={toggle}
              onSelect={(id) => {
                onSelect(id)
                onClose?.()
              }}
              onEdit={onEditFolder}
              onDelete={onDeleteFolder}
              onDrop={onDrop}
            />
          ))
        )}
      </div>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <button
          onClick={() => onNewFolder(currentFolderId)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
        >
          <FolderPlus className="h-4 w-4" /> 新建文件夹
        </button>
      </div>
    </div>
  )
}
