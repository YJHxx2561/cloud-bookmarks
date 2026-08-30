import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Wand2, Trash2 } from 'lucide-react'
import { api, ApiError } from '../api'
import { flattenFolders } from '../utils'
import { Button, Field, Input, Modal, Select, Textarea } from './ui'
import { toast, toastError } from './Toasts'
import type { Bookmark, Folder } from '../types'

// ---------- 书签编辑弹窗 ----------

export function BookmarkModal({
  open,
  bookmark,
  defaultFolderId,
  folders,
  onClose,
  onSaved,
}: {
  open: boolean
  bookmark: Bookmark | null
  defaultFolderId: string | null
  folders: Folder[]
  onClose: () => void
  onSaved: () => void
}) {
  const editing = Boolean(bookmark)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [aiDescription, setAiDescription] = useState('')
  const [aiEnabled, setAiEnabled] = useState(false)
  const [folderId, setFolderId] = useState<string>('')
  const [fetching, setFetching] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setUrl(bookmark?.url ?? '')
      setTitle(bookmark?.title ?? '')
      setDescription(bookmark?.description ?? '')
      setAiDescription(bookmark?.aiDescription ?? '')
      setAiEnabled(Boolean(bookmark?.aiEnabled))
      setFolderId(bookmark?.folderId ?? defaultFolderId ?? '')
      setErr('')
    }
  }, [open, bookmark, defaultFolderId])

  const fetchInfo = async () => {
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) {
      setErr('请输入有效的 http/https 链接')
      return
    }
    setFetching(true)
    setErr('')
    try {
      const d = await api.fetchMeta(u)
      if (d.data.title && !title.trim()) setTitle(d.data.title)
      if (d.data.description && !description.trim()) setDescription(d.data.description)
      if (!d.data.title && !title.trim()) toast('未获取到网页信息，请手动填写标题', 'info')
    } catch (e) {
      toastError(e)
    } finally {
      setFetching(false)
    }
  }

  const generateAI = async () => {
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) {
      setErr('请先填写有效的链接，再使用 AI 生成介绍')
      return
    }
    setGenerating(true)
    setErr('')
    try {
      const d = await api.aiDescription(u, title.trim())
      setAiDescription(d.data.text)
      setAiEnabled(true)
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setErr('当前未配置 Workers AI 绑定，无法生成 AI 介绍')
      } else {
        toastError(e)
      }
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) {
      setErr('请输入有效的 http/https 链接')
      return
    }
    setSaving(true)
    setErr('')
    const payload = {
      url: u,
      title: title.trim(),
      description: description.trim(),
      aiDescription: aiDescription.trim(),
      aiEnabled,
      folderId: folderId === '' ? null : folderId,
    }
    try {
      if (editing && bookmark) await api.updateBookmark(bookmark.id, payload)
      else await api.createBookmark(payload)
      toast(editing ? '书签已更新' : '书签已添加', 'success')
      onSaved()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const flatFolders = useMemo(() => flattenFolders(folders), [folders])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? '编辑书签' : '新建书签'}
      width="max-w-xl"
    >
      <div className="space-y-4">
        <Field
          label="链接"
          hint={
            <button
              type="button"
              onClick={fetchInfo}
              disabled={fetching}
              className="text-xs font-medium text-indigo-500 hover:text-indigo-600 disabled:opacity-50"
            >
              {fetching ? '获取中…' : '获取网页信息'}
            </button>
          }
        >
          <Input
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => {
              if (/^https?:\/\//i.test(url.trim()) && !title.trim()) fetchInfo()
            }}
          />
        </Field>

        <Field label="标题">
          <Input
            placeholder="网站标题（可留空自动获取）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label="简介" hint={<span className="text-xs text-slate-400">可自行修改</span>}>
          <Textarea
            rows={2}
            placeholder="网站简介（默认抓取网页标题 / 描述，可自行编辑）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3.5 dark:border-violet-900 dark:bg-violet-950/30">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-violet-700 dark:text-violet-300">
              <Sparkles className="h-4 w-4" /> AI 生成介绍
            </span>
            <Button
              variant="secondary"
              className="!px-2.5 !py-1.5 text-xs"
              onClick={generateAI}
              loading={generating}
            >
              <Wand2 className="h-3.5 w-3.5" />
              生成
            </Button>
          </div>
          <Textarea
            rows={2}
            placeholder="点击「生成」，由 Cloudflare Workers AI 自动撰写网站简介"
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            className="!bg-white dark:!bg-slate-900"
          />
          <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="h-4 w-4 rounded accent-violet-600"
            />
            在卡片上展示 AI 生成的介绍（替代手动简介）
          </label>
        </div>

        <Field label="所属文件夹">
          <Select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">根目录（不在文件夹中）</option>
            {flatFolders.map(({ folder, depth }) => (
              <option key={folder.id} value={folder.id}>
                {'　'.repeat(depth)}
                {folder.name}
              </option>
            ))}
          </Select>
        </Field>

        {err && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            {err}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} loading={saving}>
            {editing ? '保存修改' : '添加书签'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ---------- 文件夹编辑弹窗 ----------

export function FolderModal({
  open,
  folder,
  defaultParentId,
  folders,
  onClose,
  onSaved,
}: {
  open: boolean
  folder: Folder | null
  defaultParentId: string | null
  folders: Folder[]
  onClose: () => void
  onSaved: () => void
}) {
  const editing = Boolean(folder)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setName(folder?.name ?? '')
      setParentId(folder?.parentId ?? defaultParentId ?? '')
      setErr('')
    }
  }, [open, folder, defaultParentId])

  // 排除自身及后代，避免形成环
  const blocked = useMemo(() => {
    const set = new Set<string>()
    if (!folder) return set
    const stack = [folder.id]
    while (stack.length) {
      const cur = stack.pop()!
      set.add(cur)
      for (const f of folders) if (f.parentId === cur) stack.push(f.id)
    }
    return set
  }, [folder, folders])

  const flatFolders = useMemo(() => flattenFolders(folders), [folders])

  const save = async () => {
    const n = name.trim()
    if (!n) {
      setErr('请输入文件夹名称')
      return
    }
    setSaving(true)
    setErr('')
    const pid = parentId === '' ? null : parentId
    try {
      if (editing && folder) await api.updateFolder(folder.id, { name: n, parentId: pid })
      else await api.createFolder(n, pid)
      toast(editing ? '文件夹已更新' : '文件夹已创建', 'success')
      onSaved()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? '编辑文件夹' : '新建文件夹'}
      width="max-w-md"
    >
      <div className="space-y-4">
        <Field label="文件夹名称">
          <Input
            placeholder="例如：技术、生活、工作…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="上级文件夹">
          <Select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            disabled={editing}
          >
            <option value="">根目录</option>
            {flatFolders
              .filter(({ folder: f }) => !blocked.has(f.id))
              .map(({ folder: f, depth }) => (
                <option key={f.id} value={f.id}>
                  {'　'.repeat(depth)}
                  {f.name}
                </option>
              ))}
          </Select>
          {editing && (
            <span className="mt-1 block text-xs text-slate-400">
              移动文件夹请在主页中拖拽，或在树中使用拖拽调整层级
            </span>
          )}
        </Field>

        {err && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            {err}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} loading={saving}>
            {editing ? '保存修改' : '创建文件夹'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ---------- 批量移动到文件夹 ----------

export function BatchMoveModal({
  open,
  count,
  folders,
  onClose,
  onConfirm,
}: {
  open: boolean
  count: number
  folders: Folder[]
  onClose: () => void
  onConfirm: (folderId: string | null) => void
}) {
  const [folderId, setFolderId] = useState('')
  const [busy, setBusy] = useState(false)
  const flatFolders = useMemo(() => flattenFolders(folders), [folders])

  const run = async () => {
    setBusy(true)
    try {
      await onConfirm(folderId === '' ? null : folderId)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="批量移动书签" width="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          将选中的 <b className="text-indigo-600 dark:text-indigo-400">{count}</b> 个书签移动到：
        </p>
        <Field label="目标文件夹">
          <Select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">根目录（不在文件夹中）</option>
            {flatFolders.map(({ folder, depth }) => (
              <option key={folder.id} value={folder.id}>
                {'　'.repeat(depth)}
                {folder.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={run} loading={busy}>
            移动
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ---------- 确认对话框 ----------

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '删除',
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: string
  confirmText?: string
  onConfirm: () => void
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
            <Trash2 className="h-5 w-5" />
          </div>
          <p className="pt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {message}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="danger" onClick={run} loading={busy}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
