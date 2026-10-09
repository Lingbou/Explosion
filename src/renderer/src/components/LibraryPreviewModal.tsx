import React, { useState } from 'react'
import {
  X,
  BookOpen,
  Copy,
  Check,
  Upload,
  FolderOpen,
  Trash2,
  Search,
  FileText,
  Loader2,
  Sparkles,
  Folder,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from 'lucide-react'
import { useLibraryStore } from '../store/libraryStore'
import { countTextStats } from '../lib/typography'

export const LibraryPreviewModal: React.FC = () => {
  const {
    books,
    isLibraryModalOpen,
    closeLibraryModal,
    selectedBookFilename,
    selectBook,
    previewBook,
    importBooks,
    openFolder,
    deleteBook,
    processBook,
    processingFilenames
  } = useLibraryStore()

  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [openBookFolders, setOpenBookFolders] = useState<Record<string, boolean>>({})

  if (!isLibraryModalOpen) return null

  const filteredBooks = books.filter((b) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      b.filename.toLowerCase().includes(q) ||
      (b.bookName && b.bookName.toLowerCase().includes(q))
    )
  })

  // Group books by bookName
  const groupedBooks = React.useMemo(() => {
    const groups: { [key: string]: typeof books } = {}
    const standalone: typeof books = []

    for (const b of filteredBooks) {
      if (b.bookName) {
        if (!groups[b.bookName]) groups[b.bookName] = []
        groups[b.bookName].push(b)
      } else {
        standalone.push(b)
      }
    }
    return { groups, standalone }
  }, [filteredBooks])

  const toggleBookFolder = (bookName: string) => {
    setOpenBookFolders((prev) => ({
      ...prev,
      [bookName]: prev[bookName] === undefined ? false : !prev[bookName]
    }))
  }

  const handleCopy = async () => {
    if (!previewBook?.content) return
    const ok = await window.api.copyText(previewBook.content)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDelete = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`确定要从资料库中删除书籍《${filename}》吗？`)) {
      await deleteBook(filename)
    }
  }

  const handleProcess = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await processBook(filename)
  }

  const stats = previewBook ? countTextStats(previewBook.content) : null
  const sizeKb = previewBook ? (previewBook.size / 1024).toFixed(1) : '0'
  const isCurrentBookProcessing = Boolean(
    selectedBookFilename && processingFilenames.includes(selectedBookFilename)
  )

  // Safe truncation for massive texts to prevent DOM/V8 crash
  const MAX_PREVIEW_CHARS = 30000
  const isTruncated = previewBook ? previewBook.content.length > MAX_PREVIEW_CHARS : false
  const displayContent = previewBook
    ? isTruncated
      ? previewBook.content.slice(0, MAX_PREVIEW_CHARS)
      : previewBook.content
    : ''

  return (
    <div
      onClick={closeLibraryModal}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-6 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl h-[85vh] bg-[#fbfbfa] border border-stone-200 rounded-xl shadow-2xl flex flex-col overflow-hidden font-sans"
      >
        {/* Modal Top Header */}
        <div className="h-12 px-5 border-b border-stone-200 bg-white flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-stone-700 shrink-0" />
            <span className="font-semibold text-xs text-stone-900">
              素材资料库
            </span>
            <span className="text-[10px] text-stone-400 font-mono">
              ({books.length} 个分卷/书目)
            </span>

            {processingFilenames.length > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-medium ml-2 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                <span>后台拆解索引中 ({processingFilenames.length})</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={importBooks}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors font-medium shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>导入书籍</span>
            </button>
            <button
              onClick={openFolder}
              className="p-1 rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
              title="在系统文件管理器中打开"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            <button
              onClick={closeLibraryModal}
              className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors ml-1"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Two-Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Hierarchical Book List */}
          <div className="w-80 border-r border-stone-200 bg-[#f7f7f5] flex flex-col justify-between shrink-0 overflow-hidden">
            {/* Search Filter */}
            <div className="p-2.5 border-b border-stone-200 bg-white">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索资料或分卷..."
                  className="w-full pl-8 pr-2 py-1 text-xs bg-stone-50 border border-stone-200 rounded-md focus:outline-none focus:border-stone-400 focus:bg-white transition-all text-stone-800 placeholder-stone-400"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
              {filteredBooks.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400">
                  {searchQuery ? '未找到匹配资料' : '资料库暂无书籍，点击右上角导入'}
                </div>
              ) : (
                <>
                  {/* Grouped Books Folders */}
                  {Object.entries(groupedBooks.groups).map(([bName, bList]) => {
                    const isFolderOpen = openBookFolders[bName] !== false
                    return (
                      <div key={bName} className="space-y-0.5">
                        <div
                          onClick={() => toggleBookFolder(bName)}
                          className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-semibold text-stone-800 hover:bg-stone-200/50 cursor-pointer select-none transition-colors"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {isFolderOpen ? (
                              <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            )}
                            <Folder className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">{bName}</span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              ({bList.length} 卷)
                            </span>
                          </div>
                        </div>

                        {isFolderOpen && (
                          <div className="pl-4 space-y-0.5">
                            {bList.map((book) => {
                              const isSelected = book.filename === selectedBookFilename
                              const isProcessing =
                                processingFilenames.includes(book.filename) || book.isProcessing
                              const kb = (book.size / 1024).toFixed(0)

                              return (
                                <div
                                  key={book.path}
                                  onClick={() => selectBook(book.relativePath || book.filename)}
                                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-white text-stone-900 font-medium shadow-2xs border border-stone-200/80'
                                      : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                                    {isProcessing ? (
                                      <Loader2 className="w-3.5 h-3.5 shrink-0 text-amber-600 animate-spin" />
                                    ) : (
                                      <FileText
                                        className={`w-3.5 h-3.5 shrink-0 ${
                                          isSelected ? 'text-stone-800' : 'text-stone-400'
                                        }`}
                                      />
                                    )}
                                    <span className="truncate text-[11px]">{book.filename}</span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] text-stone-400 font-mono">
                                      {kb}K
                                    </span>
                                    <button
                                      onClick={(e) => handleDelete(book.relativePath || book.filename, e)}
                                      className="p-1 text-stone-400 hover:text-rose-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="删除单卷"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Standalone Books */}
                  {groupedBooks.standalone.map((book) => {
                    const isSelected = book.filename === selectedBookFilename
                    const isProcessing =
                      processingFilenames.includes(book.filename) || book.isProcessing
                    const kb = (book.size / 1024).toFixed(0)

                    return (
                      <div
                        key={book.filename}
                        onClick={() => selectBook(book.filename)}
                        className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-white text-stone-900 font-medium shadow-2xs border border-stone-200/80'
                            : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate flex-1 mr-1">
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 shrink-0 text-amber-600 animate-spin" />
                          ) : (
                            <FileText
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected ? 'text-stone-800' : 'text-stone-400'
                              }`}
                            />
                          )}
                          <span className="truncate text-xs">{book.filename}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isProcessing ? (
                            <span className="text-[10px] text-amber-600 font-medium">处理中</span>
                          ) : (
                            <span className="text-[10px] text-stone-400 font-mono">
                              {kb}K
                            </span>
                          )}

                          {!isProcessing && book.size > 200 * 1024 && (
                            <button
                              onClick={(e) => handleProcess(book.filename, e)}
                              className="p-1 text-stone-400 hover:text-amber-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              title="物理拆解分卷并建立 FTS5 索引"
                            >
                              <Sparkles className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            onClick={(e) => handleDelete(book.filename, e)}
                            className="p-1 text-stone-400 hover:text-rose-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="删除书籍"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>

          {/* Right Column: Clean Content Reading Pane */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {previewBook ? (
              <>
                {/* Viewer Top Subheader */}
                <div className="h-10 px-6 border-b border-stone-100 flex items-center justify-between select-none shrink-0 bg-stone-50/40">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-semibold text-xs text-stone-800 truncate">
                      {previewBook.filename}
                    </span>
                    {stats && (
                      <span className="text-[10px] text-stone-400 font-mono">
                        · {sizeKb} KB · 全文约 {stats.chineseChars} 字
                      </span>
                    )}

                    {isCurrentBookProcessing && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-600 font-medium px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>正在后台拆解与构建索引中...</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-0.8 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
                    <span>{copied ? '已复制' : '复制全文'}</span>
                  </button>
                </div>

                {/* Text Body */}
                <div className="flex-1 overflow-y-auto px-10 py-8 select-text scrollbar-thin bg-white">
                  <div className="max-w-3xl mx-auto">
                    {isTruncated && (
                      <div className="mb-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          超长文献已自动截断前 30,000 字供阅读预览。完整全文（共 {stats?.chineseChars} 汉字）已建立 FTS5 索引供 Agent 后台毫秒级检索。
                        </span>
                      </div>
                    )}

                    <pre className="whitespace-pre-wrap font-serif text-sm leading-[2.1] text-stone-900 tracking-wide font-normal">
                      {displayContent}
                    </pre>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400 text-xs space-y-2">
                <BookOpen className="w-8 h-8 text-stone-300 stroke-[1.5]" />
                <p>请在左侧列表中选择书籍或分卷以进行阅读与参考</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-8 px-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-[11px] text-stone-400 font-mono select-none shrink-0">
          <span>专属书目结构化收敛 · 自动建立段落级 SQLite FTS5 全文索引</span>
          <button
            onClick={closeLibraryModal}
            className="text-stone-500 hover:text-stone-800 transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
