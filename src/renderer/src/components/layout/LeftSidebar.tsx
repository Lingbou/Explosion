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
  Folder,
  AlertTriangle,
  GripVertical,
  Download
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
    isDirty,
    chapters,
    volumes,
    selectedVolume,
    collapsedVolumes,
    toggleVolumeCollapse,
    setSelectedVolume,
    createVolume,
    renameVolume,
    deleteVolume,
    reorderChapters,
    moveChapter,
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
    closeProject,
    exportManuscript,
    isExporting
  } = useWorkspaceStore()

  const {
    books,
    fetchBooks,
    importBooks,
    openFolder,
    openLibraryModal
  } = useLibraryStore()

  // 章节重命名
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editTitleValue, setEditTitleValue] = useState('')

  // 卷重命名与新建
  const [editingVolumeName, setEditingVolumeName] = useState<string | null>(null)
  const [editVolumeTitleValue, setEditVolumeTitleValue] = useState('')
  const [isCreatingVolume, setIsCreatingVolume] = useState(false)
  const [newVolumeNameInput, setNewVolumeNameInput] = useState('')

  // 卷删除确认与内容保护弹窗
  const [volumeToDelete, setVolumeToDelete] = useState<{
    name: string
    count: number
  } | null>(null)

  // 拖拽指示
  const [dragOverTarget, setDragOverTarget] = useState<{
    chapterId?: string
    volume?: string
    position?: 'before' | 'after' | 'volume-header'
  } | null>(null)

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

  const handleStartVolumeRename = (volName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingVolumeName(volName)
    setEditVolumeTitleValue(volName)
  }

  const handleFinishVolumeRename = async (oldName: string) => {
    if (editVolumeTitleValue.trim() && editVolumeTitleValue.trim() !== oldName) {
      await renameVolume(oldName, editVolumeTitleValue.trim())
    }
    setEditingVolumeName(null)
  }

  const handleFinishCreateVolume = async () => {
    if (newVolumeNameInput.trim()) {
      await createVolume(newVolumeNameInput.trim())
    }
    setIsCreatingVolume(false)
    setNewVolumeNameInput('')
  }

  const handleRequestDeleteVolume = (volName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const count = chapters.filter((c) => c.volume === volName).length
    setVolumeToDelete({ name: volName, count })
  }

  const handleConfirmDeleteVolume = async (keepChapters: boolean) => {
    if (!volumeToDelete) return
    await deleteVolume(volumeToDelete.name, keepChapters)
    setVolumeToDelete(null)
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

  const handleCreateStory = async (type: 'outline' | 'character', e: React.MouseEvent) => {
    e.stopPropagation()
    if (type === 'outline') {
      setIsOutlinesOpen(true)
    } else {
      setIsCharactersOpen(true)
    }
    await createStoryFile(type)
  }

  // 卷列表与章节分组
  const allVolumeNames = React.useMemo(() => {
    const setNames = new Set<string>(volumes)
    for (const ch of chapters) {
      if (ch.volume) setNames.add(ch.volume)
    }
    return Array.from(setNames).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    )
  }, [volumes, chapters])

  const hasVolumes = allVolumeNames.length > 0

  const volumeGroups = React.useMemo(() => {
    const groups: Record<string, typeof chapters> = {}
    for (const v of allVolumeNames) {
      groups[v] = []
    }
    for (const ch of chapters) {
      if (ch.volume) {
        if (!groups[ch.volume]) groups[ch.volume] = []
        groups[ch.volume].push(ch)
      }
    }
    return groups
  }, [allVolumeNames, chapters])

  const unassignedChapters = React.useMemo(() => {
    return chapters.filter((c) => !c.volume)
  }, [chapters])

  // HTML5 DnD 处理逻辑
  const handleDragStart = (
    e: React.DragEvent,
    ch: { id: string; filename: string; volume?: string }
  ) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        chapterId: ch.id,
        filename: ch.filename,
        sourceVolume: ch.volume
      })
    )
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOverChapter = (
    e: React.DragEvent,
    targetChapter: { id: string; volume?: string }
  ) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const isUpper = e.clientY - rect.top < rect.height / 2
    setDragOverTarget({
      chapterId: targetChapter.id,
      volume: targetChapter.volume,
      position: isUpper ? 'before' : 'after'
    })
  }

  const handleDropOnChapter = async (
    e: React.DragEvent,
    targetChapter: { id: string; filename: string; volume?: string }
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const targetPos = dragOverTarget?.position || 'after'
    setDragOverTarget(null)

    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    try {
      const data = JSON.parse(raw) as {
        chapterId: string
        filename: string
        sourceVolume?: string
      }

      if (data.chapterId === targetChapter.id) return

      const targetVol = targetChapter.volume
      const containerChapters = targetVol
        ? (volumeGroups[targetVol] || [])
        : unassignedChapters

      const targetIdx = containerChapters.findIndex((c) => c.id === targetChapter.id)
      if (targetIdx === -1) return

      const insertIndex = targetPos === 'before' ? targetIdx : targetIdx + 1

      if (data.sourceVolume === targetVol) {
        // 同卷内重排
        const filenames = containerChapters.map((c) => c.filename)
        const fromIdx = filenames.indexOf(data.filename)
        if (fromIdx !== -1) {
          filenames.splice(fromIdx, 1)
          const finalInsert = targetPos === 'before' ? targetIdx : (fromIdx < targetIdx ? targetIdx : targetIdx + 1)
          filenames.splice(finalInsert, 0, data.filename)
          await reorderChapters(targetVol, filenames)
        }
      } else {
        // 跨卷移动
        await moveChapter({
          chapterId: data.chapterId,
          filename: data.filename,
          sourceVolume: data.sourceVolume,
          targetVolume: targetVol,
          targetIndex: insertIndex
        })
      }
    } catch {
      // ignore
    }
  }

  const handleDragOverVolumeHeader = (e: React.DragEvent, volumeName: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTarget({
      volume: volumeName,
      position: 'volume-header'
    })
  }

  const handleDropOnVolumeHeader = async (e: React.DragEvent, volumeName: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverTarget(null)

    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    try {
      const data = JSON.parse(raw) as {
        chapterId: string
        filename: string
        sourceVolume?: string
      }

      if (data.sourceVolume === volumeName) return

      const volChapters = volumeGroups[volumeName] || []
      await moveChapter({
        chapterId: data.chapterId,
        filename: data.filename,
        sourceVolume: data.sourceVolume,
        targetVolume: volumeName,
        targetIndex: volChapters.length
      })
    } catch {
      // ignore
    }
  }

  // 章节条目渲染函数
  const renderChapterItem = (
    ch: typeof chapters[0],
    index: number,
    opts?: { isInsideVolume?: boolean }
  ) => {
    const stats = countTextStats(ch.content)
    const isActive = activeDocumentType === 'chapter' && ch.id === activeChapterId
    const isEditing = ch.id === editingChapterId
    const isDropBefore = dragOverTarget?.chapterId === ch.id && dragOverTarget?.position === 'before'
    const isDropAfter = dragOverTarget?.chapterId === ch.id && dragOverTarget?.position === 'after'

    return (
      <div
        key={ch.id}
        draggable={!isEditing}
        onDragStart={(e) => handleDragStart(e, ch)}
        onDragOver={(e) => handleDragOverChapter(e, ch)}
        onDragLeave={() => {
          if (dragOverTarget?.chapterId === ch.id) {
            setDragOverTarget(null)
          }
        }}
        onDrop={(e) => handleDropOnChapter(e, ch)}
        onClick={() => selectChapter(ch.id)}
        onDoubleClick={(e) => handleStartRename(ch.id, ch.title, e)}
        className={`group relative flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-all ${
          isActive
            ? 'bg-white dark:bg-[#252321] text-stone-900 dark:text-stone-100 font-medium shadow-2xs border border-stone-200/60 dark:border-stone-700'
            : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-100'
        } ${isDropBefore ? 'border-t-2 border-stone-800' : ''} ${
          isDropAfter ? 'border-b-2 border-stone-800' : ''
        } ${opts?.isInsideVolume ? 'ml-3' : ''}`}
      >
        <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
          <GripVertical className="w-3 h-3 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab active:cursor-grabbing" />
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
              className="bg-white dark:bg-[#181716] border border-stone-400 dark:border-stone-600 rounded px-1 text-xs text-stone-900 dark:text-stone-100 w-full focus:outline-none"
            />
          ) : (
            <>
              <span className="truncate">{ch.title || `第 ${index + 1} 章`}</span>
              {isActive && isDirty && (
                <span
                  className="w-2 h-2 rounded-full bg-stone-400 dark:bg-stone-500 opacity-80 shrink-0"
                  title="未保存更改"
                  data-testid="dirty-indicator"
                />
              )}
            </>
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
                  if (window.confirm(`确定要删除章节《${ch.title}》吗？`)) {
                    deleteChapter(ch.id)
                  }
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
  }

  return (
    <aside
      style={{ width: `${width}px` }}
      className="border-r border-stone-200 dark:border-stone-800 bg-[#f7f7f5] dark:bg-[#181716] flex flex-col justify-between select-none shrink-0 overflow-hidden h-full"
    >
      {/* Top Header: Column-Integrated Project Switcher Bar (Compact h-9) */}
      <div className="h-9 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1f1e1c] px-2 flex items-center justify-between select-none shrink-0 relative z-30">
        <div ref={projectMenuRef} className="relative flex-1 mr-1 min-w-0">
          <button
            onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors w-full text-left"
            title="点击切换或管理小说工程"
          >
            <FolderOpen className="w-3 h-3 text-stone-500 dark:text-stone-400 shrink-0" />
            <span className="truncate flex-1">
              {projectPath ? projectTitle || '未命名作品' : '未打开工程'}
            </span>
            <ChevronDown className="w-2.5 h-2.5 text-stone-400 shrink-0" />
          </button>

          {/* Project Switcher Dropdown Menu */}
          {isProjectMenuOpen && (
            <div
              className="absolute left-0 top-full mt-0.5 w-56 bg-white dark:bg-[#22211f] border border-stone-200 dark:border-stone-700 rounded-md shadow-xl py-1 text-xs z-50 animate-in fade-in duration-100 font-sans"
            >
              <div className="px-2.5 py-1 border-b border-stone-100 dark:border-stone-800 text-[10px] text-stone-400 dark:text-stone-500 truncate font-mono">
                {projectPath ? projectPath : '尚未关联本地小说文件夹'}
              </div>

              <button
                onClick={() => {
                  setIsProjectMenuOpen(false)
                  createProject()
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              >
                <FolderPlus className="w-3 h-3 text-stone-500" />
                <span>新建小说工程文件夹...</span>
              </button>

              <button
                onClick={() => {
                  setIsProjectMenuOpen(false)
                  openProject()
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              >
                <FolderOpen className="w-3 h-3 text-stone-500" />
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
                    className="w-full text-left px-2.5 py-1.5 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors border-t border-stone-100 dark:border-stone-800"
                  >
                    重命名小说名称...
                  </button>
                  <button
                    onClick={() => {
                      setIsProjectMenuOpen(false)
                      exportManuscript()
                    }}
                    disabled={isExporting}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors border-t border-stone-100 dark:border-stone-800 flex items-center gap-2"
                  >
                    <Download className="w-3 h-3 text-stone-500" />
                    <span>交稿导出全书 (.txt)...</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsProjectMenuOpen(false)
                      closeProject()
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors border-t border-stone-100 dark:border-stone-800 flex items-center gap-2"
                  >
                    <X className="w-3 h-3" />
                    <span>关闭当前工程</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Quick Add Chapter & Add Volume when project is open */}
        {projectPath && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => {
                setIsCreatingVolume(true)
                setNewVolumeNameInput(`第${allVolumeNames.length + 1}卷`)
              }}
              className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              title="新建分卷"
            >
              <FolderPlus className="w-3 h-3" />
            </button>
            <button
              onClick={() => addChapter()}
              className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              title="新建章节（落在当前选中的卷）"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Main Scrollable Area: Chapters & Story Bible */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {/* If no project is open, show onboarding card */}
        {!projectPath && (
          <div className="p-3.5 rounded-lg bg-white dark:bg-[#1f1e1c] border border-stone-200/80 dark:border-stone-800 space-y-2.5">
            <div>
              <div className="font-semibold text-xs text-stone-800 dark:text-stone-200">未选择小说工程</div>
              <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
                选择本地文件夹以管理章节手稿与设定
              </p>
            </div>
            <div className="flex flex-col gap-1.5 pt-0.5">
              <button
                onClick={createProject}
                className="w-full py-1.5 px-2.5 rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:bg-stone-800 dark:hover:bg-white flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>新建小说工程</span>
              </button>
              <button
                onClick={openProject}
                className="w-full py-1.5 px-2.5 rounded-md bg-white dark:bg-[#252422] border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <FolderOpen className="w-3.5 h-3.5 text-stone-500" />
                <span>打开已有工程</span>
              </button>
            </div>
          </div>
        )}

        {/* Chapters Section (Volume-Tree or Flat Fallback) */}
        {projectPath && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-stone-400" />
                <span>手稿 ({chapters.length})</span>
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => {
                    setIsCreatingVolume(true)
                    setNewVolumeNameInput(`第${allVolumeNames.length + 1}卷`)
                  }}
                  className="p-1 rounded text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
                  title="新建分卷"
                >
                  <FolderPlus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => addChapter()}
                  className="p-1 rounded text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
                  title="新建下一章"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Inline Volume Creation Input */}
            {isCreatingVolume && (
              <div className="px-2 py-1 bg-white dark:bg-[#181716] border border-stone-300 dark:border-stone-700 rounded-md shadow-2xs flex items-center gap-1.5 mb-1.5">
                <Layers className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <input
                  type="text"
                  value={newVolumeNameInput}
                  onChange={(e) => setNewVolumeNameInput(e.target.value)}
                  onBlur={handleFinishCreateVolume}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishCreateVolume()
                    if (e.key === 'Escape') {
                      setIsCreatingVolume(false)
                      setNewVolumeNameInput('')
                    }
                  }}
                  autoFocus
                  placeholder="输入分卷名称..."
                  className="bg-transparent text-xs text-stone-900 dark:text-stone-100 w-full focus:outline-none"
                />
              </div>
            )}

            {hasVolumes ? (
              // Multi-volume tree view
              <div className="space-y-2">
                {allVolumeNames.map((volName) => {
                  const volChapters = volumeGroups[volName] || []
                  const isCollapsed = collapsedVolumes[volName] ?? false
                  const isSelected = selectedVolume === volName
                  const isEditingVol = editingVolumeName === volName
                  const isDragTargetHeader =
                    dragOverTarget?.volume === volName &&
                    dragOverTarget?.position === 'volume-header'

                  const totalChars = volChapters.reduce(
                    (acc, c) => acc + countTextStats(c.content).chineseChars,
                    0
                  )

                  return (
                    <div
                      key={volName}
                      className={`space-y-0.5 rounded-lg transition-colors ${
                        isSelected ? 'bg-stone-100/60 dark:bg-stone-800/40 p-1' : 'p-0.5'
                      }`}
                    >
                      {/* Volume Header Bar */}
                      <div
                        onClick={() => {
                          setSelectedVolume(volName)
                          toggleVolumeCollapse(volName)
                        }}
                        onDragOver={(e) => handleDragOverVolumeHeader(e, volName)}
                        onDragLeave={() => {
                          if (dragOverTarget?.volume === volName) {
                            setDragOverTarget(null)
                          }
                        }}
                        onDrop={(e) => handleDropOnVolumeHeader(e, volName)}
                        className={`group flex items-center justify-between px-2 py-1.5 text-xs text-stone-700 hover:bg-stone-200/50 rounded-md cursor-pointer transition-colors ${
                          isDragTargetHeader
                            ? 'bg-amber-100/70 border-2 border-dashed border-amber-500'
                            : ''
                        }`}
                        title="点击选择该卷并展开/收起；可将章节拖入此卷"
                      >
                        <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleVolumeCollapse(volName)
                            }}
                            className="p-0.5 text-stone-400 hover:text-stone-700 rounded"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <Layers className="w-3.5 h-3.5 text-stone-500 shrink-0" />

                          {isEditingVol ? (
                            <input
                              type="text"
                              value={editVolumeTitleValue}
                              onChange={(e) => setEditVolumeTitleValue(e.target.value)}
                              onBlur={() => handleFinishVolumeRename(volName)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleFinishVolumeRename(volName)
                                if (e.key === 'Escape') setEditingVolumeName(null)
                              }}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              className="bg-white dark:bg-[#181716] border border-stone-400 dark:border-stone-600 rounded px-1 text-xs text-stone-900 dark:text-stone-100 w-full focus:outline-none"
                            />
                          ) : (
                            <span
                              onDoubleClick={(e) => handleStartVolumeRename(volName, e)}
                              className="font-medium text-xs text-stone-800 truncate"
                            >
                              {volName}
                            </span>
                          )}

                          <span className="text-[10px] text-stone-400 font-mono">
                            ({volChapters.length})
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {totalChars > 0 && !isEditingVol && (
                            <span className="text-[10px] text-stone-400 font-mono group-hover:text-stone-500 mr-0.5">
                              {totalChars}字
                            </span>
                          )}

                          {!isEditingVol && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  addChapter(undefined, volName)
                                }}
                                className="p-0.5 text-stone-400 hover:text-stone-700 rounded"
                                title="在此卷下新建章节"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => handleStartVolumeRename(volName, e)}
                                className="p-0.5 text-stone-400 hover:text-stone-700 rounded"
                                title="重命名卷"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => handleRequestDeleteVolume(volName, e)}
                                className="p-0.5 text-stone-400 hover:text-rose-600 rounded"
                                title="删除卷 (内容保护)"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Chapters inside this volume */}
                      {!isCollapsed && (
                        <div className="space-y-0.5 pt-0.5">
                          {volChapters.length === 0 ? (
                            <div
                              onClick={() => addChapter(undefined, volName)}
                              className="px-3 py-1.5 ml-3 text-[11px] text-stone-400 italic hover:text-stone-600 cursor-pointer rounded hover:bg-stone-200/40"
                            >
                              暂无章节，点击 + 新建
                            </div>
                          ) : (
                            volChapters.map((ch, idx) =>
                              renderChapterItem(ch, idx, { isInsideVolume: true })
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Unassigned / Root Chapters if any */}
                {unassignedChapters.length > 0 && (
                  <div className="space-y-0.5 pt-1 border-t border-stone-200/50">
                    <div className="px-2 py-1 text-[10px] font-medium text-stone-400 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-stone-400" />
                        <span>未分卷章节 ({unassignedChapters.length})</span>
                      </div>
                      <button
                        onClick={() => addChapter(undefined, undefined)}
                        className="p-0.5 text-stone-400 hover:text-stone-700 rounded"
                        title="新建未分卷章节"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    {unassignedChapters.map((ch, idx) =>
                      renderChapterItem(ch, idx, { isInsideVolume: false })
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Linear flat chapter list (Zero-migration compatibility for legacy flat projects)
              <div className="space-y-0.5">
                {chapters.map((ch, index) => renderChapterItem(ch, index, { isInsideVolume: false }))}
              </div>
            )}
          </div>
        )}

        {/* Content Protection Modal for Volume Deletion */}
        {volumeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-100 font-sans">
            <div className="bg-white dark:bg-[#1f1e1c] rounded-xl shadow-2xl border border-stone-200 dark:border-stone-800 max-w-sm w-full p-4.5 space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    删除分卷《{volumeToDelete.name}》
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                    {volumeToDelete.count > 0 ? (
                      <>
                        该卷下包含{' '}
                        <span className="font-semibold text-stone-800 dark:text-stone-200">
                          {volumeToDelete.count}
                        </span>{' '}
                        个章节手稿。为保障小说内容安全，请选择删除方式：
                      </>
                    ) : (
                      '该卷下暂无章节手稿，确定删除该空卷吗？'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                {volumeToDelete.count > 0 ? (
                  <>
                    <button
                      onClick={() => handleConfirmDeleteVolume(true)}
                      className="w-full py-2 px-3 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:bg-stone-800 dark:hover:bg-white flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    >
                      <span>保留手稿并删除卷 (推荐)</span>
                    </button>
                    <button
                      onClick={() => handleConfirmDeleteVolume(false)}
                      className="w-full py-1.5 px-3 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <span>彻底删除卷及所有章节手稿</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConfirmDeleteVolume(false)}
                    className="w-full py-2 px-3 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 text-center transition-colors shadow-2xs cursor-pointer"
                  >
                    确认删除
                  </button>
                )}
                <button
                  onClick={() => setVolumeToDelete(null)}
                  className="w-full py-1.5 px-3 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Story Bible Section (本作设定 - 真实目录树状结构) */}
        {projectPath && (
          <div className="border-t border-stone-200/60 dark:border-stone-800 pt-3 space-y-1">
            <div
              onClick={() => setIsStoryBibleOpen(!isStoryBibleOpen)}
              className="flex items-center justify-between px-2 mb-1 cursor-pointer text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
                <BookMarked className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
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
                    className="flex items-center justify-between px-2 py-1.5 text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-200/40 dark:hover:bg-stone-800/60 rounded cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isOutlinesOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500 shrink-0" />
                      <span className="font-medium text-xs text-stone-800 dark:text-stone-200">大纲规划</span>
                      <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">
                        ({storyBible?.outlines?.length || 0})
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleCreateStory('outline', e)}
                      className="p-0.5 hover:text-stone-900 dark:hover:text-stone-100 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 rounded cursor-pointer"
                      title="新建大纲文件"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isOutlinesOpen && (
                    <div className="pl-5 space-y-0.5">
                      {storyBible?.outlines?.length === 0 ? (
                        <div className="px-2 py-1 text-[11px] text-stone-400 dark:text-stone-500">
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
                                  ? 'bg-white dark:bg-[#252321] text-stone-900 dark:text-stone-100 font-medium shadow-2xs border border-stone-200/60 dark:border-stone-700'
                                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-200'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                                <FileText className="w-3 h-3 text-amber-700 dark:text-amber-500 shrink-0" />
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
                                    className="bg-white dark:bg-[#181716] border border-stone-400 dark:border-stone-600 rounded px-1 text-xs text-stone-900 dark:text-stone-100 w-full focus:outline-none"
                                  />
                                ) : (
                                  <>
                                    <span className="truncate text-[11px]">{outline.title}</span>
                                    {isActive && isDirty && (
                                      <span
                                        className="w-2 h-2 rounded-full bg-stone-400 dark:bg-stone-500 opacity-80 shrink-0"
                                        title="未保存更改"
                                        data-testid="dirty-indicator"
                                      />
                                    )}
                                  </>
                                )}
                              </div>

                              {!isEditing && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => handleStartStoryRename(outline.relativePath, outline.title, e)}
                                    className="p-0.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded cursor-pointer"
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
                                    className="p-0.5 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
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
                    className="flex items-center justify-between px-2 py-1.5 text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-200/40 dark:hover:bg-stone-800/60 rounded cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isCharactersOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-blue-600 dark:text-blue-500 shrink-0" />
                      <span className="font-medium text-xs text-stone-800 dark:text-stone-200">人物档案</span>
                      <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">
                        ({storyBible?.characters?.length || 0})
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleCreateStory('character', e)}
                      className="p-0.5 hover:text-stone-900 dark:hover:text-stone-100 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 rounded cursor-pointer"
                      title="新建人物小传"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isCharactersOpen && (
                    <div className="pl-5 space-y-0.5">
                      {storyBible?.characters?.length === 0 ? (
                        <div className="px-2 py-1 text-[11px] text-stone-400 dark:text-stone-500">
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
                                  ? 'bg-white dark:bg-[#252321] text-stone-900 dark:text-stone-100 font-medium shadow-2xs border border-stone-200/60 dark:border-stone-700'
                                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-200'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                                <User className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
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
                                    className="bg-white dark:bg-[#181716] border border-stone-400 dark:border-stone-600 rounded px-1 text-xs text-stone-900 dark:text-stone-100 w-full focus:outline-none"
                                  />
                                ) : (
                                  <>
                                    <span className="truncate text-[11px]">{char.title}</span>
                                    {isActive && isDirty && (
                                      <span
                                        className="w-2 h-2 rounded-full bg-stone-400 dark:bg-stone-500 opacity-80 shrink-0"
                                        title="未保存更改"
                                        data-testid="dirty-indicator"
                                      />
                                    )}
                                  </>
                                )}
                              </div>

                              {!isEditing && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => handleStartStoryRename(char.relativePath, char.title, e)}
                                    className="p-0.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded cursor-pointer"
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
                                    className="p-0.5 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
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
                {storyBible?.ledger && (() => {
                  const isActive =
                    activeDocumentType === 'story' &&
                    activeStoryFile?.relativePath === storyBible.ledger.relativePath
                  return (
                    <div
                      onClick={() => selectStoryFile(storyBible.ledger!)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-white dark:bg-[#252321] text-stone-900 dark:text-stone-100 font-medium shadow-2xs border border-stone-200/60 dark:border-stone-700'
                          : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                        <Bookmark className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span className="font-medium text-xs text-stone-800 dark:text-stone-200">暗线</span>
                        {isActive && isDirty && (
                          <span
                            className="w-2 h-2 rounded-full bg-stone-400 dark:bg-stone-500 opacity-80 shrink-0"
                            title="未保存更改"
                            data-testid="dirty-indicator"
                          />
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Pinned Library Entry (Ultra compact) */}
      <div className="p-2 border-t border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-[#1a1918]/80 shrink-0">
        <div
          onClick={openLibraryModal}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-stone-100/90 dark:hover:bg-stone-800/90 cursor-pointer transition-colors text-xs text-stone-700 dark:text-stone-300 border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
          title="点击打开资料库管理与阅读弹层"
        >
          <div className="flex items-center gap-2 truncate">
            <BookOpen className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400 shrink-0" />
            <span className="font-medium text-xs text-stone-800 dark:text-stone-200">资料库</span>
            <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono px-1.5 py-0.2 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
              {books.length}
            </span>
          </div>

          <div
            className="flex items-center gap-1 shrink-0 ml-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={importBooks}
              className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              title="导入外部 TXT 长篇小说"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={openFolder}
              className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
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
