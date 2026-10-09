import React, { useState, useEffect, useRef } from 'react'
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
  Layers,
  Folder
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
    setProjectTitle,
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
    renameStoryFile,
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

  const [editingStoryRelPath, setEditingStoryRelPath] = useState<string | null>(null)
  const [editStoryTitleValue, setEditStoryTitleValue] = useState('')

  const [isStoryBibleOpen, setIsStoryBibleOpen] = useState(true)
  const [isOutlinesOpen, setIsOutlinesOpen] = useState(true)
  const [isCharactersOpen, setIsCharactersOpen] = useState(true)

  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false)
  const projectMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  // Close project menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setIsProjectMenuOpen(false)
      }
    }
    if (isProjectMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isProjectMenuOpen])

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

  const handleStartStoryRename = (relPath: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingStoryRelPath(relPath)
    setEditStoryTitleValue(currentTitle)
  }

  const handleFinishStoryRename = (relPath: string) => {
    if (editStoryTitleValue.trim()) {
      renameStoryFile(relPath, editStoryTitleValue.trim())
    }
    setEditingStoryRelPath(null)
  }

  // Create new story file without window.prompt: instant on-the-fly creation
  const handleCreateStory = async (type: 'outline' | 'character', e: React.MouseEvent) => {
    e.stopPropagation()
    if (type === 'outline') {
      setIsOutlinesOpen(true)
    } else {
      setIsCharactersOpen(true)
    }
    await createStoryFile(type)
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
      {/* Top Header: Column-Integrated Project Switcher Bar */}
      <div className="h-11 border-b border-stone-200 bg-white px-3 flex items-center justify-between select-none shrink-0 relative z-30">
        <div ref={projectMenuRef} className="relative flex-1 mr-1">
          <button
            onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
            className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-xs font-semibold text-stone-900 hover:bg-stone-100 transition-colors w-full text-left"
            title="点击切换或管理小说工程"
          >
            <FolderOpen className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            <span className="truncate flex-1">
              {projectPath ? projectTitle || '未命名作品' : '未打开工程'}
            </span>
            <ChevronDown className="w-3 h-3 text-stone-400 shrink-0" />
          </button>

          {/* Project Switcher Dropdown Menu */}
          {isProjectMenuOpen && (
            <div
              className="absolute left-0 mt-1 w-60 bg-white border border-stone-200 rounded-lg shadow-xl py-1 text-xs z-50 animate-in fade-in duration-100 font-sans"
            >
              <div className="px-3 py-1.5 border-b border-stone-100 text-[10px] text-stone-400 truncate font-mono">
                {projectPath ? projectPath : '尚未关联本地小说文件夹'}
              </div>

              <button
                onClick={() => {
                  setIsProjectMenuOpen(false)
                  createProject()
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-stone-50 flex items-center gap-2 text-stone-700 hover:text-stone-900 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 text-stone-500" />
                <span>新建小说工程文件夹...</span>
              </button>

              <button
                onClick={() => {
                  setIsProjectMenuOpen(false)
                  openProject()
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-stone-50 flex items-center gap-2 text-stone-700 hover:text-stone-900 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-stone-500" />
                <span>打开已有小说文件夹...</span>
              </button>

              {projectPath && (
                <>
                  <button
                    onClick={() => {
                      setIsProjectMenuOpen(false)
                      const newTitle = window.prompt('请输入新的小说作品名称：', projectTitle)
                      if (newTitle && newTitle.trim()) {
                        setProjectTitle(newTitle.trim())
                      }
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition-colors border-t border-stone-100"
                  >
                    重命名小说名称...
                  </button>
                  <button
                    onClick={() => {
                      setIsProjectMenuOpen(false)
                      closeProject()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition-colors border-t border-stone-100 flex items-center gap-2"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>关闭当前工程</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Quick Add Chapter Button when project is open */}
        {projectPath && (
          <button
            onClick={() => addChapter()}
            className="p-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors shrink-0"
            title="新建章节"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Scrollable Area: Chapters & Story Bible */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {/* If no project is open, show onboarding card */}
        {!projectPath && (
          <div className="p-3.5 rounded-lg bg-white border border-stone-200/80 space-y-2.5">
            <div>
              <div className="font-semibold text-xs text-stone-800">未选择小说工程</div>
              <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
                选择本地文件夹以管理章节手稿与设定
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
        )}

        {/* Chapters Section (Multi-Volume Support) */}
        {projectPath && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-stone-400" />
                <span>手稿 ({chapters.length})</span>
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

        {/* Story Bible Section (本作设定 - 真实目录树状结构) */}
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
              <div className="space-y-1.5 pl-0.5">
                {/* 1. Outlines Folder (大纲规划) */}
                <div className="space-y-0.5">
                  <div
                    onClick={() => setIsOutlinesOpen(!isOutlinesOpen)}
                    className="flex items-center justify-between px-2 py-1.5 text-xs text-stone-600 hover:bg-stone-200/40 rounded cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isOutlinesOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="font-medium text-xs text-stone-800">大纲规划</span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        ({storyBible?.outlines?.length || 0})
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleCreateStory('outline', e)}
                      className="p-0.5 hover:text-stone-900 text-stone-500 hover:bg-stone-200 rounded"
                      title="新建大纲文件"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isOutlinesOpen && (
                    <div className="pl-5 space-y-0.5">
                      {storyBible?.outlines?.length === 0 ? (
                        <div className="px-2 py-1 text-[11px] text-stone-400">
                          暂无大纲，点击上方 + 新建
                        </div>
                      ) : (
                        storyBible?.outlines?.map((outline) => {
                          const isActive =
                            activeDocumentType === 'story' &&
                            activeStoryFile?.relativePath === outline.relativePath
                          const isEditing = editingStoryRelPath === outline.relativePath

                          return (
                            <div
                              key={outline.id}
                              onClick={() => selectStoryFile(outline)}
                              onDoubleClick={(e) => handleStartStoryRename(outline.relativePath, outline.title, e)}
                              className={`group flex items-center justify-between px-2 py-1 rounded-md text-xs cursor-pointer transition-colors ${
                                isActive
                                  ? 'bg-white text-stone-900 font-medium shadow-2xs border border-stone-200/60'
                                  : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                                <FileText className="w-3 h-3 text-amber-700 shrink-0" />
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editStoryTitleValue}
                                    onChange={(e) => setEditStoryTitleValue(e.target.value)}
                                    onBlur={() => handleFinishStoryRename(outline.relativePath)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleFinishStoryRename(outline.relativePath)
                                      if (e.key === 'Escape') setEditingStoryRelPath(null)
                                    }}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-white border border-stone-400 rounded px-1 text-xs text-stone-900 w-full focus:outline-none"
                                  />
                                ) : (
                                  <span className="truncate text-[11px]">{outline.title}</span>
                                )}
                              </div>

                              {!isEditing && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => handleStartStoryRename(outline.relativePath, outline.title, e)}
                                    className="p-0.5 text-stone-400 hover:text-stone-700 rounded"
                                    title="重命名大纲"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (window.confirm(`确定要删除大纲《${outline.title}》吗？`)) {
                                        deleteStoryFile(outline.relativePath)
                                      }
                                    }}
                                    className="p-0.5 text-stone-400 hover:text-rose-600 rounded"
                                    title="删除大纲"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Characters Folder (人物档案) */}
                <div className="space-y-0.5">
                  <div
                    onClick={() => setIsCharactersOpen(!isCharactersOpen)}
                    className="flex items-center justify-between px-2 py-1.5 text-xs text-stone-600 hover:bg-stone-200/40 rounded cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isCharactersOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-medium text-xs text-stone-800">人物档案</span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        ({storyBible?.characters?.length || 0})
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleCreateStory('character', e)}
                      className="p-0.5 hover:text-stone-900 text-stone-500 hover:bg-stone-200 rounded"
                      title="新建人物小传"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isCharactersOpen && (
                    <div className="pl-5 space-y-0.5">
                      {storyBible?.characters?.length === 0 ? (
                        <div className="px-2 py-1 text-[11px] text-stone-400">
                          暂无人物，点击上方 + 新建
                        </div>
                      ) : (
                        storyBible?.characters?.map((char) => {
                          const isActive =
                            activeDocumentType === 'story' &&
                            activeStoryFile?.relativePath === char.relativePath
                          const isEditing = editingStoryRelPath === char.relativePath

                          return (
                            <div
                              key={char.id}
                              onClick={() => selectStoryFile(char)}
                              onDoubleClick={(e) => handleStartStoryRename(char.relativePath, char.title, e)}
                              className={`group flex items-center justify-between px-2 py-1 rounded-md text-xs cursor-pointer transition-colors ${
                                isActive
                                  ? 'bg-white text-stone-900 font-medium shadow-2xs border border-stone-200/60'
                                  : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                                <User className="w-3 h-3 text-blue-600 shrink-0" />
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editStoryTitleValue}
                                    onChange={(e) => setEditStoryTitleValue(e.target.value)}
                                    onBlur={() => handleFinishStoryRename(char.relativePath)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleFinishStoryRename(char.relativePath)
                                      if (e.key === 'Escape') setEditingStoryRelPath(null)
                                    }}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-white border border-stone-400 rounded px-1 text-xs text-stone-900 w-full focus:outline-none"
                                  />
                                ) : (
                                  <span className="truncate text-[11px]">{char.title}</span>
                                )}
                              </div>

                              {!isEditing && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => handleStartStoryRename(char.relativePath, char.title, e)}
                                    className="p-0.5 text-stone-400 hover:text-stone-700 rounded"
                                    title="重命名人物"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (window.confirm(`确定要删除人物档案《${char.title}》吗？`)) {
                                        deleteStoryFile(char.relativePath)
                                      }
                                    }}
                                    className="p-0.5 text-stone-400 hover:text-rose-600 rounded"
                                    title="删除人物档案"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Threads (暗线) */}
                {storyBible?.ledger && (
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
                      <Bookmark className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="font-medium text-xs text-stone-800">暗线</span>
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
          title="点击打开资料库管理与阅读弹层"
        >
          <div className="flex items-center gap-2 truncate">
            <BookOpen className="w-3.5 h-3.5 text-stone-600 shrink-0" />
            <span className="font-medium text-xs text-stone-800">资料库</span>
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
