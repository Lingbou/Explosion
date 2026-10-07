import React, { useState } from 'react'
import { X, BookOpen, Copy, Check } from 'lucide-react'
import { useLibraryStore } from '../store/libraryStore'
import { countTextStats } from '../lib/typography'

export const LibraryPreviewModal: React.FC = () => {
  const { previewBook, isPreviewOpen, closePreview } = useLibraryStore()
  const [copied, setCopied] = useState(false)

  if (!isPreviewOpen || !previewBook) return null

  const stats = countTextStats(previewBook.content)
  const sizeKb = (previewBook.size / 1024).toFixed(1)

  const handleCopy = async () => {
    const ok = await window.api.copyText(previewBook.content)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl h-[85vh] bg-[#fbfbfa] border border-stone-200 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 px-5 border-b border-stone-200 bg-white flex items-center justify-between select-none">
          <div className="flex items-center gap-2.5 truncate flex-1 mr-4">
            <BookOpen className="w-4 h-4 text-stone-700 shrink-0" />
            <span className="font-semibold text-xs text-stone-900 truncate">
              {previewBook.filename}
            </span>
            <span className="text-[10px] text-stone-400 font-mono">
              ({sizeKb} KB · 约 {stats.chineseChars} 字)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制' : '复制全文'}</span>
            </button>
            <button
              onClick={closePreview}
              className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 overflow-y-auto px-10 py-8 select-text scrollbar-thin">
          <div className="max-w-2xl mx-auto">
            <pre className="whitespace-pre-wrap font-serif text-sm leading-[2.2] text-stone-900 tracking-wide font-normal">
              {previewBook.content}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="h-9 px-5 border-t border-stone-200 bg-white flex items-center justify-between text-[11px] text-stone-500 font-mono select-none">
          <span>素材藏书库原始纯文本预览</span>
          <button
            onClick={closePreview}
            className="text-stone-600 hover:text-stone-900 transition-colors"
          >
            关闭阅读
          </button>
        </div>
      </div>
    </div>
  )
}
