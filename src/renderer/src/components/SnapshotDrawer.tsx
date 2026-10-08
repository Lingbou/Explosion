import React, { useState, useEffect } from 'react'
import {
  X,
  History,
  RotateCcw,
  Sparkles,
  User,
  Clock,
  FileText,
  AlertCircle
} from 'lucide-react'
import { ProjectSnapshot } from '../../../shared/types/ipc'
import { useWorkspaceStore } from '../store/workspaceStore'

interface SnapshotDrawerProps {
  isOpen: boolean
  onClose: () => void
  currentFilename?: string
  currentFilePath?: string
}

export const SnapshotDrawer: React.FC<SnapshotDrawerProps> = ({
  isOpen,
  onClose,
  currentFilename,
  currentFilePath
}) => {
  const { projectPath, loadProjectByPath } = useWorkspaceStore()
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([])
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const fetchSnapshots = async () => {
    if (!projectPath) return
    setIsLoading(true)
    try {
      const list = await window.api.listSnapshots({
        projectPath,
        filename: currentFilename
      })
      setSnapshots(list)
      if (list.length > 0) {
        setSelectedSnapshotId(list[0].id)
        const content = await window.api.getSnapshotContent({
          projectPath,
          snapshotId: list[0].id
        })
        setPreviewContent(content)
      } else {
        setSelectedSnapshotId(null)
        setPreviewContent('')
      }
    } catch {
      setSnapshots([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchSnapshots()
    }
  }, [isOpen, projectPath, currentFilename])

  const handleSelectSnapshot = async (id: string) => {
    if (!projectPath) return
    setSelectedSnapshotId(id)
    try {
      const content = await window.api.getSnapshotContent({
        projectPath,
        snapshotId: id
      })
      setPreviewContent(content)
    } catch {
      setPreviewContent('')
    }
  }

  const handleRestore = async () => {
    if (!projectPath || !selectedSnapshotId) return

    const targetSnap = snapshots.find((s) => s.id === selectedSnapshotId)
    if (!targetSnap) return

    const confirmMsg = `确定要将手稿《${targetSnap.filename}》回滚恢复到 ${new Date(
      targetSnap.timestamp
    ).toLocaleString()} 的版本吗？当前未保存的改动将被快照覆盖。`

    if (!window.confirm(confirmMsg)) return

    setIsRestoring(true)
    try {
      await window.api.restoreSnapshot({
        projectPath,
        snapshotId: selectedSnapshotId
      })
      await loadProjectByPath(projectPath)
      onClose()
    } catch (err) {
      alert(`回滚失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsRestoring(false)
    }
  }

  if (!isOpen) return null

  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId)

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-6 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl h-[85vh] bg-[#fbfbfa] border border-stone-200 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="h-12 px-5 border-b border-stone-200 bg-white flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-2.5">
            <History className="w-4 h-4 text-stone-700 shrink-0" />
            <span className="font-semibold text-xs text-stone-900">
              本地时光机 · 防丢稿版本回滚
            </span>
            {currentFilename && (
              <span className="text-[11px] font-mono text-stone-500">
                ({currentFilename})
              </span>
            )}
            <span className="text-[10px] text-stone-400 font-mono">
              · {snapshots.length} 个历史快照
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body: Two Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Snapshot Timeline */}
          <div className="w-80 border-r border-stone-200 bg-[#f7f7f5] flex flex-col justify-between shrink-0 overflow-hidden">
            <div className="p-2.5 border-b border-stone-200 bg-white text-[11px] font-semibold text-stone-500 uppercase tracking-wider flex items-center justify-between">
              <span>快照版本时间线</span>
              {isLoading && <span className="text-[10px] text-stone-400">加载中...</span>}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {snapshots.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400 space-y-2">
                  <Clock className="w-6 h-6 text-stone-300 mx-auto stroke-[1.5]" />
                  <p>暂无历史修改快照</p>
                  <p className="text-[10px] text-stone-400">
                    当 Agent 自动改写手稿或手工保存时，系统会自动在此生成防丢稿版本快照。
                  </p>
                </div>
              ) : (
                snapshots.map((snap) => {
                  const isSelected = snap.id === selectedSnapshotId
                  const dateStr = new Date(snap.timestamp).toLocaleString([], {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })

                  return (
                    <div
                      key={snap.id}
                      onClick={() => handleSelectSnapshot(snap.id)}
                      className={`p-2.5 rounded-lg text-xs cursor-pointer transition-colors border ${
                        isSelected
                          ? 'bg-white text-stone-900 shadow-2xs border-stone-300'
                          : 'bg-transparent border-transparent text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[11px] font-medium text-stone-800">
                          {dateStr}
                        </span>

                        {snap.source === 'agent' && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>AI 改写前</span>
                          </span>
                        )}
                        {snap.source === 'manual' && (
                          <span className="flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            <User className="w-2.5 h-2.5" />
                            <span>手工保存</span>
                          </span>
                        )}
                        {snap.source === 'rollback' && (
                          <span className="flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>回滚快照</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-stone-400 font-mono">
                        <span className="truncate max-w-[140px]">{snap.filename}</span>
                        <span>{snap.charCount} 字符</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right: Snapshot Content Preview & Restore */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {selectedSnapshot ? (
              <>
                {/* Preview Toolbar */}
                <div className="h-11 px-6 border-b border-stone-100 flex items-center justify-between select-none shrink-0 bg-stone-50/50">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 text-stone-500" />
                    <span className="font-semibold text-xs text-stone-800">
                      快照版本预览
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      · {selectedSnapshot.charCount} 字符
                    </span>
                  </div>

                  <button
                    onClick={handleRestore}
                    disabled={isRestoring}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-md transition-colors shadow-2xs disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isRestoring ? '正在还原...' : '一键回滚恢复至此版本'}</span>
                  </button>
                </div>

                {/* Text Body */}
                <div className="flex-1 overflow-y-auto px-10 py-8 select-text scrollbar-thin bg-white">
                  <div className="max-w-3xl mx-auto">
                    <pre className="whitespace-pre-wrap font-serif text-sm leading-[2.1] text-stone-900 tracking-wide font-normal">
                      {previewContent}
                    </pre>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400 text-xs space-y-2">
                <AlertCircle className="w-6 h-6 text-stone-300" />
                <p>请在左侧选择快照以查看历史版本文本与进行一键回滚</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-8 px-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-[11px] text-stone-400 font-mono select-none shrink-0">
          <span>防丢稿保护 · 每次 Agent 改写与重要保存均自动生成不可篡改的本地物理快照</span>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-800 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
