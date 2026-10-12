import React, { useEffect, useState } from 'react'
import { CheckCircle2, Copy, Check, X, FileText } from 'lucide-react'
import { useWorkspaceStore } from '../store/workspaceStore'

export const ExportFeedbackToast: React.FC = () => {
  const { exportResult, dismissExportResult } = useWorkspaceStore()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!exportResult?.visible) return

    const timer = setTimeout(() => {
      dismissExportResult()
    }, 8000)

    return () => clearTimeout(timer)
  }, [exportResult, dismissExportResult])

  if (!exportResult?.visible) return null

  const handleCopyPath = async () => {
    if (!exportResult.filePath) return
    const ok = await window.api.copyText(exportResult.filePath)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-white border border-stone-200/90 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-200 font-sans select-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
              <span>全书手稿交稿导出成功</span>
              <span className="text-[10px] font-normal text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                .txt 纯文本
              </span>
            </h4>
            <p className="text-[11px] text-stone-500 mt-0.5">
              已合并 {exportResult.chapterCount} 个章节 · 共 {exportResult.totalChars.toLocaleString()} 字 · 段首全角缩进规范排版
            </p>
          </div>
        </div>
        <button
          onClick={dismissExportResult}
          className="p-1 text-stone-400 hover:text-stone-700 rounded-md transition-colors"
          title="关闭提示"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Visible File Path Box */}
      <div className="mt-3 bg-stone-50 border border-stone-200/70 rounded-lg p-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <span
            className="font-mono text-[11px] text-stone-700 truncate select-all"
            title={exportResult.filePath}
          >
            {exportResult.filePath}
          </span>
        </div>
        <button
          onClick={handleCopyPath}
          className={`px-2 py-1 text-[10px] font-medium rounded transition-all shrink-0 flex items-center gap-1 shadow-2xs border ${
            copied
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
          }`}
          title="复制导出文件完整路径"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-stone-500" />}
          <span>{copied ? '已复制' : '复制路径'}</span>
        </button>
      </div>
    </div>
  )
}
