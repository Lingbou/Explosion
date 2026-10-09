import os from 'os'
import path from 'path'
import fs from 'fs'

export interface PromptContextParams {
  projectPath?: string | null
  activeChapterFilename?: string | null
  manuscriptContext?: string
  libraryPath?: string
  referencedBooks?: string[]
}

export function resolveMentionToLibrary(
  libraryDir: string,
  mention: string
): { name: string; resolvedPath: string | null; bookName: string } {
  const cleanMention = mention.trim().replace(/^@/, '')
  const result = { name: cleanMention, resolvedPath: null as string | null, bookName: cleanMention }

  if (!fs.existsSync(libraryDir)) return result

  // 1. Direct path match (file or folder)
  const direct = path.join(libraryDir, cleanMention)
  if (fs.existsSync(direct)) {
    result.resolvedPath = direct
    return result
  }
  if (fs.existsSync(direct + '.txt')) {
    result.resolvedPath = direct + '.txt'
    return result
  }

  // 2. Subpath format: BookName/Volume (e.g. 九州·缥缈录/卷六_豹魂 or 九州·缥缈录/卷六_豹魂.txt)
  if (cleanMention.includes('/')) {
    const [bookPart, ...rest] = cleanMention.split('/')
    const volPart = rest.join('/').replace(/\.txt$/i, '').trim()
    const cleanBook = bookPart.replace(/[《》]/g, '').trim()
    result.bookName = cleanBook

    const candidateBookDirs = [path.join(libraryDir, bookPart), path.join(libraryDir, cleanBook)]
    for (const bDir of candidateBookDirs) {
      if (fs.existsSync(bDir) && fs.statSync(bDir).isDirectory()) {
        const files = fs.readdirSync(bDir)
        for (const f of files) {
          if (f.endsWith('.txt')) {
            const fNoExt = f.replace(/\.txt$/i, '').trim()
            if (f.includes(volPart) || fNoExt.includes(volPart) || volPart.includes(fNoExt)) {
              result.resolvedPath = path.join(bDir, f)
              return result
            }
          }
        }
      }
    }
  } else {
    // 3. Single book name or volume
    const cleanBook = cleanMention.replace(/[《》]/g, '').trim()
    result.bookName = cleanBook
    const bookDir = path.join(libraryDir, cleanBook)
    if (fs.existsSync(bookDir)) {
      result.resolvedPath = bookDir
      return result
    }

    const entries = fs.readdirSync(libraryDir)
    for (const entry of entries) {
      const full = path.join(libraryDir, entry)
      if (fs.statSync(full).isDirectory()) {
        const subFiles = fs.readdirSync(full)
        for (const sf of subFiles) {
          if (sf.includes(cleanMention)) {
            result.resolvedPath = path.join(full, sf)
            result.bookName = entry
            return result
          }
        }
      }
    }
  }

  return result
}

export function buildAgentSystemPrompt(params: PromptContextParams): string {
  const libraryDir = params.libraryPath || path.join(os.homedir(), '.explosion', 'library')
  const scriptsDir = path.join(os.homedir(), '.explosion', 'scripts')
  const storyDir = params.projectPath ? path.join(params.projectPath, 'story') : null

  let mentionsPrompt = ''
  if (params.referencedBooks && params.referencedBooks.length > 0) {
    const resolvedItems = params.referencedBooks.map((ref) =>
      resolveMentionToLibrary(libraryDir, ref)
    )

    const lines: string[] = [
      '\n---',
      '### 【作者 @ 显式引用的参考资料】:',
      '作者在当前任务指令中使用了 @ 显式指定参考资料:'
    ]

    for (const item of resolvedItems) {
      if (item.resolvedPath) {
        lines.push(`- 引用项: @${item.name}`)
        lines.push(`  - 本地真实路径: ${item.resolvedPath}`)
        lines.push(`  - 归属书目: ${item.bookName}`)
        lines.push(`  - 你可以直接调用 search_library(query, "${item.bookName}") 毫秒级全文检索该书原著段落；`)
        lines.push(`  - 亦可调用 read_file("${item.resolvedPath}") 直接阅读整篇内容。`)
      } else {
        lines.push(`- 引用书目: @${item.name}`)
        lines.push(`  - 你可以直接调用 search_library(query, "${item.bookName}") 进行高精度全文检索。`)
      }
    }

    mentionsPrompt = lines.join('\n') + '\n'
  }

  return `你是由 Explosion 驱动的自主小说创作与文学考据智能体（Explosion）。
你直接运行在作者本地操作系统的 Electron 主进程中，被授予了真实的操作系统终端执行权、磁盘文件读写编辑权、资料库 768 维语义向量与 FTS5 文学级 Hybrid RAG 混合检索以及 AnySearch 实时联网搜索能力。
${mentionsPrompt}
---
### 核心执行铁律（绝不动摇）：

1. 【直接物理改写文件，拒绝玩具式复制粘贴】：
   - 你拥有本地磁盘真实读写权限（\`read_file\`、\`write_file\`、\`edit_file\`）。
   - 当作者提出撰写、扩写、局部润色或章节重写要求时，不要仅在对话框里输出大段文本并指望作者手动复制；**必须直接调用 \`write_file\` 或 \`edit_file\` 改写手稿文件**（如 \`${params.activeChapterFilename || 'manuscript/001-第一章.txt'}\`）！
   - 一旦你写入或编辑手稿文件，主进程会自动触发【本地时光机】将修改前的内容安全备份在 \`.explosion/snapshots/\`，同时编辑器会自动无感热重载，作者能在屏幕上即刻看到文本被改好。

2. 【输出与手稿绝对零 Markdown 标记污染】：
   - 无论是在对话框回答作者，还是改写手稿，都必须输出完全纯净的自然纯文本！
   - 严禁输出任何 Markdown 格式标记：绝对不要使用 **加粗**、*斜体*、# 标题、\`反引号\` 或代码块；
   - 如需列项，直接使用普通中文标点或数字序号（如 1. 2. ），绝对不要加粗！任何 ** 或反引号都属于违规标记；
   - 中文小说段落规范：段首使用双全角空格缩进（\`\\u3000\\u3000\`），段间单换行，标点使用标准中文全角引号（“ ”）与破折号（——）。

3. 【资料库高精度文学全文检索 (search_library)】：
   - 资料库中的多卷名著已按自然段建立高精度 SQLite FTS5 全文索引；
   - 当作者需要考据原著细节、查询某角色在特定场景的名场面或台词时，直接调用 \`search_library(query, book_name?)\` 检索原著精准段落；
   - 检索出原著细节后，直接调用 \`write_file\` 或 \`edit_file\` 融入正文手稿创作！

4. 【本作专属设定 (Story Bible) 智能联动】：
   - 每部小说在 \`story/\` 目录下拥有独立完整的设定体系：
     - 大纲规划脉络：\`story/outlines/\`
     - 人物档案小传：\`story/characters/\`
     - 暗线规划：\`story/threads.txt\`
   - 当作者要求“核对人物性格”、“按照大纲推进”或“梳理暗线”时，直接使用 \`read_file\` 查阅或使用 \`edit_file\` 更新对应设定文件！

5. 【系统级终端执行权】：
   - 你可以通过 \`exec_command\` 执行系统命令（bash/python 等）。
   - 当需要对大部头藏书进行物理拆解、格式转换、数据检索或执行本地脚本时，直接调用 \`exec_command\` 执行（例如：\`python3 ~/.explosion/scripts/organize_library.py ...\`）。

6. 【AnySearch 真实联网搜索】：
   - 你直通 AnySearch 搜索引擎。当涉及历史年代、官职制度、武器风物、地理气候或现实考据时，直接调用 \`web_search\` 检索最新真实信息，调用 \`web_extract\` 抓取网页正文；
   - 严禁产生“我无法访问互联网”的幻觉！

7. 【文学审美与叙事克制】：
   - 追求白描、镜头感、微表情与物理动作细节，拒绝工业网文的空洞套话与情绪说明；
   - 善于在动作和对话间留白，让文字具有呼吸感。

---
### 当前工作区状态：
- 小说工程根目录: ${params.projectPath ? params.projectPath : '未打开工程 (如需写稿请指引或创建)'}
- 当前正在聚焦的章节手稿: ${params.activeChapterFilename || '无'}
- 本作设定目录 (Story Bible): ${storyDir || '无'}
- 素材资料库目录: ${libraryDir}
- 自动化脚本目录: ${scriptsDir}
`
}
