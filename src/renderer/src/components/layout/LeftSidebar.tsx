import React, { useState, useEffect } from 'react'
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  FolderOpen,
  Upload,
  BookOpen,
  FolderPlus,
  X,
  BookMarked,
  User,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Layers
} from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useLibraryStore } from '../../store/libraryStore'
import { countTextStats } from '../../lib/typography'

interface LeftSidebarProps {
  width: number
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ width }) => {
  const {
    projectPath,
    projectTitle,
    chapters,
    activeChapterId,
    activeDocumentType,
    activeStoryFile,
    storyBible,
    selectChapter,
    selectStoryFile,
    addChapter,
    deleteChapter,
    updateChapterTitle,
    createStoryFile,
    deleteStoryFile,
    openProject,
    createProject,
    closeProject
  } = useWorkspaceStore()

  const {
    books,
    fetchBooks,
    importBooks,
    openFolder,
    openLibraryModal
  } = useLibraryStore()

  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editTitleValue, setEditTitleValue] = useState('')
  const [isStoryBibleOpen, setIsStoryBibleOpen] = useState(true)

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

  const handleCreateStory = (type: 'outline' | 'character', e: React.MouseEvent) => {
    e.stopPropagation()
    const promptTitle = window.prompt(type === 'outline' ? '请输入大纲标题（如：第一卷主线细纲）：' : '请输入人物姓名（如：主角姓名）：')
    if (promptTitle && promptTitle.trim()) {
      createStoryFile(type, promptTitle.trim())
    }
  }

  // Group chapters by volume
  const volumeGroups = React.useMemo(() => {
    const groups: Record<string, typeof chapters> = {}
    for (const ch of chapters) {
      const vol = ch.volume || '正文'
      if (!groups[vol]) groups[vol] = []
      groups[vol].push(ch)
    }
    return groups
  }, [chapters])

  const volumeNames = Object.keys(volumeGroups)
  const hasMultipleVolumes = volumeNames.length > 1 || (volumeNames.length === 1 && volumeNames[0] !== '正文')

  return (
    <aside
      style={{ width: `${width}px` }}
      className="border-r border-stone-200 bg-[#f7f7f5] flex flex-col justify-between select-none shrink-0 overflow-hidden h-full"
    >
      {/* Top Main Area: Project Card, Chapters & Story Bible */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {/* Project Card */}
        {!projectPath ? (
          <div className="p-3 rounded-lg bg-white border border-stone-200/80 space-y-2.5">
            <div>
              <div className="font-semibold text-xs text-stone-800">未选择小说工程</div>
              <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
                选择本地文件夹以管理章节手稿
              </p>
            </div>
            <div className="flex flex-col gap-1.5 pt-0.5">
              <button
                onClick={createProject}
                className="w-full py-1.5 px-2.5 rounded-md bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>新建小说工程</span>
              </button>
              <button
                onClick={openProject}
                className="w-full py-1.5 px-2.5 rounded-md bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <FolderOpen className="w-3.5 h-3.5 text-stone-500" />
                <span>打开已有工程</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-white border border-stone-200/80 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-900 truncate flex-1 mr-1">
                {projectTitle}
              </span>
              <button
                onClick={closeProject}
                className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
                title="关闭当前工程"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[10px] text-stone-400 font-mono truncate">
              {projectPath}
            </div>
          </div>
        )}

        {/* Chapters Section (Multi-Volume Support) */}
        {projectPath && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-stone-400" />
                <span>手稿章节 ({chapters.length})</span>
              </span>
              <button
                onClick={() => addChapter()}
                className="p-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
                title="新建下一章"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {hasMultipleVolumes ? (
              // Multi-volume grouped view
              <div className="space-y-2">
                {volumeNames.map((volName) => (
                  <div key={volName} className="space-y-0.5">
                    <div className="px-2 py-1 text-[10px] font-medium text-stone-400 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-stone-400" />
                      <span>{volName}</span>
                    </div>

                    {volumeGroups[volName].map((ch) => {
                      const stats = countTextStats(ch.content)
                      const isActive = activeDocumentType === 'chapter' && ch.id === activeChapterId
                      const isEditing = ch.id === editingChapterId

                      return (
                        <div
                          key={ch.id}
                          onClick={() => selectChapter(ch.id)}
                          onDoubleClick={(e) => handleStartRename(ch.id, ch.title, e)}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-white text-stone-900 font-medium shadow-2xs border border-stone-200/60'
                              : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate flex-1 mr-1">
                            <span className="truncate">{ch.title}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {stats.chineseChars > 0 && !isEditing && (
                              <span className="text-[10px] text-stone-400 font-mono group-hover:text-stone-500">
                                {stats.chineseChars}
                              </span>
                            )}
                            {!isEditing && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteChapter(ch.id)
                                }}
                                className="p-0.5 text-stone-400 hover:text-rose-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="删除章节"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ) : (
              // Linear flat chapter list
              <div className="space-y-0.5">
                {chapters.map((ch, index) => {
                  const stats = countTextStats(ch.content)
                  const isActive = activeDocumentType === 'chapter' && ch.id === activeChapterId
                  const isEditing = ch.id === editingChapterId

                  return (
                    <div
                      key={ch.id}
                      onClick={() => selectChapter(ch.id)}
                      onDoubleClick={(e) => handleStartRename(ch.id, ch.title, e)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-white text-stone-900 font-medium shadow-2xs border border-stone-200/60'
                          : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 mr-1">
                        <FileText
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-stone-900' : 'text-stone-400'
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
            )}
          </div>
        )}

        {/* Story Bible Section (本作设定) */}
        {projectPath && (
          <div className="border-t border-stone-200/60 pt-3 space-y-1">
            <div
              onClick={() => setIsStoryBibleOpen(!isStoryBibleOpen)}
              className="flex items-center justify-between px-2 mb-1 cursor-pointer text-stone-500 hover:text-stone-800 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
                <BookMarked className="w-3.5 h-3.5 text-stone-500" />
                <span>本作设定 (Story Bible)</span>
              </div>
              {isStoryBibleOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
              )}
            </div>

            {isStoryBibleOpen && (
              <div className="space-y-2 pl-1">
                {/* 1. Outlines */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between px-2 py-1 text-[10px] font-medium text-stone-400">
                    <span>大纲规划 ({storyBible?.outlines?.length || 0})</span>
                    <button
                      onClick={(e) => handleCreateStory('outline', e)}
                      className="p-0.5 hover:text-stone-800 rounded"
                      title="新建大纲文档"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {storyBible?.outlines?.map((outline) => {
                    const isActive =
                      activeDocumentType === 'story' &&
                      activeStoryFile?.relativePath === outline.relativePath

                    return (
                      <div
                        key={outline.id}
                        onClick={() => selectStoryFile(outline)}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-white text-stone-900 font-medium shadow-2xs border border-stone-200/60'
                            : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                        }`}
                      >
                        <span className="truncate flex-1 mr-1">{outline.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (window.confirm(`确定要删除大纲《${outline.title}》吗？`)) {
                              deleteStoryFile(outline.relativePath)
                            }
                          }}
                          className="p-0.5 text-stone-400 hover:text-rose-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="删除大纲"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* 2. Characters */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between px-2 py-1 text-[10px] font-medium text-stone-400">
                    <span>人物档案 ({storyBible?.characters?.length || 0})</span>
                    <button
                      onClick={(e) => handleCreateStory('character', e)}
                      className="p-0.5 hover:text-stone-800 rounded"
                      title="新建人物小传卡片"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {storyBible?.characters?.map((char) => {
                    const isActive =
                      activeDocumentType === 'story' &&
                      activeStoryFile?.relativePath === char.relativePath

                    return (
                      <div
                        key={char.id}
                        onClick={() => selectStoryFile(char)}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-white text-stone-900 font-medium shadow-2xs border border-stone-200/60'
                            : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                          <User className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="truncate">{char.title}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (window.confirm(`确定要删除人物档案《${char.title}》吗？`)) {
                              deleteStoryFile(char.relativePath)
                            }
                          }}
                          className="p-0.5 text-stone-400 hover:text-rose-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="删除人物档案"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* 3. Ledger */}
                {storyBible?.ledger && (
                  <div className="space-y-0.5">
                    <div className="px-2 py-1 text-[10px] font-medium text-stone-400">
                      伏笔账本
                    </div>
                    <div
                      onClick={() => selectStoryFile(storyBible.ledger!)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                        activeDocumentType === 'story' &&
                        activeStoryFile?.relativePath === storyBible.ledger.relativePath
                          ? 'bg-white text-stone-900 font-medium shadow-2xs border border-stone-200/60'
                          : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Bookmark className="w-3 h-3 text-purple-600 shrink-0" />
                        <span className="truncate">伏笔暗线账本</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Pinned Library Entry (Ultra compact) */}
      <div className="p-2 border-t border-stone-200 bg-white/70 shrink-0">
        <div
          onClick={openLibraryModal}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-stone-100/90 cursor-pointer transition-colors text-xs text-stone-700 border border-transparent hover:border-stone-200"
          title="点击打开藏书库管理与阅读弹层"
        >
          <div className="flex items-center gap-2 truncate">
            <BookOpen className="w-3.5 h-3.5 text-stone-600 shrink-0" />
            <span className="font-medium text-xs text-stone-800">藏书库</span>
            <span className="text-[10px] text-stone-400 font-mono px-1.5 py-0.2 rounded-full bg-stone-100 border border-stone-200">
              {books.length}
            </span>
          </div>

          <div
            className="flex items-center gap-1 shrink-0 ml-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={importBooks}
              className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-200/60 transition-colors"
              title="导入外部 TXT 长篇小说"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={openFolder}
              className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-200/60 transition-colors"
              title="在系统文件管理器中打开藏书目录"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
