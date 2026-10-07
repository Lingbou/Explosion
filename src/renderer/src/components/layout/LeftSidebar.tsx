import React from 'react'
import {
  BookOpen,
  FileText,
  Plus,
  Trash2,
  FolderOpen,
  Users,
  Compass,
  BookmarkCheck,
  HardDrive
} from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useConfigStore } from '../../store/configStore'
import { countTextStats } from '../../lib/typography'

export const LeftSidebar: React.FC = () => {
  const { chapters, activeChapterId, selectChapter, addChapter, deleteChapter } =
    useWorkspaceStore()
  const { config } = useConfigStore()

  return (
    <aside className="w-64 border-r border-stone-800/80 bg-stone-950 flex flex-col justify-between select-none">
      {/* Top Part: Chapter Tree & Story Lore */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-5">
        {/* Chapters Section */}
        <div>
          <div className="flex items-center justify-between px-1.5 mb-2">
            <span className="text-[11px] font-bold tracking-wider text-stone-400 uppercase flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-500" />
              手稿章节目录
            </span>
            <button
              onClick={() => addChapter()}
              className="p-1 rounded text-stone-400 hover:text-amber-400 hover:bg-stone-900 transition-colors"
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
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-all ${
                    isActive
                      ? 'bg-stone-900 text-stone-100 font-medium border-l-2 border-amber-500'
                      : 'text-stone-400 hover:bg-stone-900/60 hover:text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1">
                    <FileText
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-amber-400' : 'text-stone-600'
                      }`}
                    />
                    <span className="truncate">{ch.title || `第 ${index + 1} 章`}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-stone-600 font-mono group-hover:text-stone-500">
                      {stats.chineseChars}字
                    </span>
                    {chapters.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteChapter(ch.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-stone-600 hover:text-rose-400 transition-opacity"
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

        {/* Story Lore & Outlines Section */}
        <div>
          <div className="px-1.5 mb-2">
            <span className="text-[11px] font-bold tracking-wider text-stone-400 uppercase flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-500/80" />
              本作专属内生设定
            </span>
          </div>

          <div className="space-y-0.5 text-xs text-stone-400">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-stone-900/60 cursor-pointer text-stone-400 hover:text-stone-200 transition-colors">
              <Users className="w-3.5 h-3.5 text-stone-500" />
              <span>人物档案</span>
              <span className="ml-auto text-[10px] text-stone-600">开放键值</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-stone-900/60 cursor-pointer text-stone-400 hover:text-stone-200 transition-colors">
              <Compass className="w-3.5 h-3.5 text-stone-500" />
              <span>大纲与分卷脉络</span>
              <span className="ml-auto text-[10px] text-stone-600">卷章树</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-stone-900/60 cursor-pointer text-stone-400 hover:text-stone-200 transition-colors">
              <BookmarkCheck className="w-3.5 h-3.5 text-stone-500" />
              <span>伏笔与线索账本</span>
              <span className="ml-auto text-[10px] text-stone-600">动态跟踪</span>
            </div>
          </div>
        </div>

        {/* Universal Library Section */}
        <div>
          <div className="px-1.5 mb-2">
            <span className="text-[11px] font-bold tracking-wider text-stone-400 uppercase flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-amber-500/80" />
              独立素材藏书库 (Library)
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-stone-900/60 border border-stone-800/80 text-xs">
            <div className="text-stone-300 font-medium flex items-center gap-1.5">
              <span>通用长篇原始书目</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
              大部头全本原始 TXT 物理隔离存储于系统目录，不污染当前单部小说工程。
            </p>
            <div className="text-[10px] font-mono text-stone-600 truncate mt-2 bg-stone-950 p-1.5 rounded border border-stone-800">
              {config.workspace.libraryPath}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer: Direct File Binding Indicator */}
      <div className="p-3 border-t border-stone-800/80 bg-stone-950/80 flex items-center gap-2 text-[11px] text-stone-500">
        <HardDrive className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />
        <span className="truncate">本地真实文件直通 · 零中间转存</span>
      </div>
    </aside>
  )
}
