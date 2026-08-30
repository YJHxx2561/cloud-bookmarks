import { ExternalLink, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { faviconFor, hostOf, setDragItem } from '../utils'
import type { Bookmark } from '../types'

export default function BookmarkCard({
  bookmark,
  index,
  onEdit,
  onDelete,
  onDrop,
}: {
  bookmark: Bookmark
  index: number
  onEdit: () => void
  onDelete: () => void
  onDrop: (folderId: string | null, index?: number) => void
}) {
  const showAI = Boolean(bookmark.aiEnabled && bookmark.aiDescription)
  const icon = faviconFor(bookmark.url)

  return (
    <div
      draggable
      onDragStart={(e) => {
        setDragItem({ type: 'bookmark', id: bookmark.id })
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={() => setDragItem(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDrop(bookmark.folderId, index)
      }}
      className="group relative flex cursor-grab flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-700"
    >
      <div className="flex items-start gap-3">
        <img
          src={icon}
          alt=""
          className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-slate-100 object-contain p-1 dark:bg-slate-800"
          onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
        />
        <div className="min-w-0 flex-1">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1 truncate font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
            title={bookmark.title || bookmark.url}
          >
            <span className="truncate">{bookmark.title || hostOf(bookmark.url)}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-60" />
          </a>
          <p className="mt-0.5 truncate text-xs text-slate-400">{hostOf(bookmark.url)}</p>
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
            title="编辑"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showAI && (
        <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-violet-700 dark:text-violet-300">
          <Sparkles className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
          {bookmark.aiDescription}
        </p>
      )}
      {!showAI && bookmark.description && (
        <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          {bookmark.description}
        </p>
      )}
    </div>
  )
}
