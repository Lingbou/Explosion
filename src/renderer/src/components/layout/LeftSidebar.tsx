import React from 'react'
import {
  FileText,
  Plus,
  Trash2,
  FolderOpen
} from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useConfigStore } from '../../store/configStore'
import { countTextStats } from '../../lib/typography'

export const LeftSidebar: React.FC = () => {
  const { chapters, activeChapterId, selectChapter, addChapter, deleteChapter } =
    useWorkspaceStore()
  const { config } = useConfigStore()

  return (
    <aside className="w-60 border-r border-stone-200 bg-[#f7f7f5] flex flex-col justify-between select-none">
      {/* Top Part: Chapter Tree */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {/* Chapters Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              手稿章节
            </span>
            <button
              onClick={() => addChapter()}
              className="p-1 rounded text-stone-400 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
              title="新建章节"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {chapters.map((ch, index) => {
              const stats = countTextStats(ch.content)
              const isActive = ch.id === activeChapterId

              return (
                <div
                  key={ch.id}
                  onClick={() => selectChapter(ch.id)}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition-all ${
                    isActive
                      ? 'bg-white text-stone-900 font-medium shadow-xs border border-stone-200/80'
                      : 'text-stone-600 hover:bg-stone-200/40 hover:text-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1">
                    <FileText
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-stone-800' : 'text-stone-400'
                      }`}
                    />
                    <span className="truncate">{ch.title || `第 ${index + 1} 章`}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {stats.chineseChars > 0 && (
                      <span className="text-[10px] text-stone-400 font-mono group-hover:text-stone-500">
                        {stats.chineseChars}
                      </span>
                    )}
                    {chapters.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteChapter(ch.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-stone-400 hover:text-rose-600 transition-opacity"
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
        </div>
      </div>

      {/* Bottom Part: Clean Library Entry */}
      <div className="p-3 border-t border-stone-200/80 bg-[#f7f7f5]">
        <div className="p-2.5 rounded-lg bg-white border border-stone-200/80 text-xs">
          <div className="flex items-center gap-1.5 text-stone-700 font-medium text-[11px]">
            <FolderOpen className="w-3.5 h-3.5 text-stone-500" />
            <span>素材藏书库 (Library)</span>
          </div>
          <div className="text-[10px] font-mono text-stone-500 truncate mt-1 bg-stone-50 p-1 rounded border border-stone-100">
            {config.workspace.libraryPath}
          </div>
        </div>
      </div>
    </aside>
  )
}
