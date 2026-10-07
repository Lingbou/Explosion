import React, { useState, useEffect } from 'react'
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  FolderOpen,
  Upload,
  BookOpen,
  FolderPlus
} from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useLibraryStore } from '../../store/libraryStore'
import { countTextStats } from '../../lib/typography'

interface LeftSidebarProps {
  width: number
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ width }) => {
  const {
    chapters,
    activeChapterId,
    selectChapter,
    addChapter,
    deleteChapter,
    updateChapterTitle,
    projectPath,
    openProject,
    createProject
  } = useWorkspaceStore()

  const {
    books,
    fetchBooks,
    importBooks,
    openFolder,
    openPreview
  } = useLibraryStore()

  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editTitleValue, setEditTitleValue] = useState('')

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingChapterId(id)
    setEditTitleValue(currentTitle)
  }

  const handleFinishRename = (id: string) => {
    if (editTitleValue.trim()) {
      updateChapterTitle(id, editTitleValue.trim())
    }
    setEditingChapterId(null)
  }

  return (
    <aside
      style={{ width: `${width}px` }}
      className="border-r border-stone-200 bg-[#f7f7f5] flex flex-col justify-between select-none shrink-0 overflow-hidden"
    >
      {/* Top Part: Project Info & Chapter Tree */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {/* Project Header Card */}
        <div className="p-2 rounded-lg bg-white border border-stone-200/80">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-800 truncate">
              {projectPath ? '当前小说工程' : '本地暂存工程'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={openProject}
                className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"
                title="打开本地小说工程目录"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={createProject}
                className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"
                title="新建小说工程目录"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="text-[10px] text-stone-400 font-mono truncate mt-1">
            {projectPath || '未关联目录 · 自动保存在内存'}
          </div>
        </div>

        {/* Chapters Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              手稿章节 ({chapters.length})
            </span>
            <button
              onClick={() => addChapter()}
              className="p-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
              title="新建下一章"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {chapters.map((ch, index) => {
              const stats = countTextStats(ch.content)
              const isActive = ch.id === activeChapterId
              const isEditing = ch.id === editingChapterId

              return (
                <div
                  key={ch.id}
                  onClick={() => selectChapter(ch.id)}
                  onDoubleClick={(e) => handleStartRename(ch.id, ch.title, e)}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition-all ${
                    isActive
                      ? 'bg-white text-stone-900 font-medium shadow-2xs border border-stone-200/80'
                      : 'text-stone-600 hover:bg-stone-200/40 hover:text-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 mr-1">
                    <FileText
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-stone-800' : 'text-stone-400'
                      }`}
                    />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onBlur={() => handleFinishRename(ch.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFinishRename(ch.id)
                          if (e.key === 'Escape') setEditingChapterId(null)
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white border border-stone-400 rounded px-1 text-xs text-stone-900 w-full focus:outline-none"
                      />
                    ) : (
                      <span className="truncate">{ch.title || `第 ${index + 1} 章`}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {stats.chineseChars > 0 && !isEditing && (
                      <span className="text-[10px] text-stone-400 font-mono group-hover:text-stone-500">
                        {stats.chineseChars}
                      </span>
                    )}

                    {!isEditing && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleStartRename(ch.id, ch.title, e)}
                          className="p-0.5 text-stone-400 hover:text-stone-700 rounded"
                          title="重命名章节"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteChapter(ch.id)
                          }}
                          className="p-0.5 text-stone-400 hover:text-rose-600 rounded"
                          title="删除章节"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Library Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-stone-500" />
              素材藏书库 ({books.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={importBooks}
                className="p-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
                title="导入外部 TXT 长篇小说"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={openFolder}
                className="p-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
                title="在文件管理器中打开藏书目录"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
            {books.length === 0 ? (
              <div className="px-2 py-3 text-center rounded-lg border border-dashed border-stone-300 text-stone-400 text-[11px]">
                暂无藏书，点击上方按钮导入
              </div>
            ) : (
              books.map((book) => {
                const sizeKb = (book.size / 1024).toFixed(0)
                return (
                  <div
                    key={book.filename}
                    onClick={() => openPreview(book.filename)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-stone-700 hover:bg-stone-200/60 hover:text-stone-900 cursor-pointer transition-colors"
                    title={`点击预览阅读: ${book.filename}`}
                  >
                    <span className="truncate flex-1 mr-2">{book.filename}</span>
                    <span className="text-[10px] text-stone-400 font-mono shrink-0">
                      {sizeKb}K
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
