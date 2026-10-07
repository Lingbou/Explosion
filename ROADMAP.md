# Explosion - 现代化 AI 小说创作工作台 Roadmap

> **项目代号**：Explosion（灵感源自素晴的爆裂魔法，象征创作灵感的瞬间绽放）  
> **核心定位**：拒绝“工业糖精网文生成器”。打造**人机深度协同、文风与题材绝对自由、以本地文件为唯一事实源、零 Markdown 污染**的专业级小说创作桌面工作台。

---

## 零、 核心设计哲学

1. **工作区即记忆（Workspace as Memory）**  
   摒弃让 LLM 无限压缩长聊天记录的陈旧套路，彻底杜绝“越聊越忘、细节尽失”的上下文腐烂（Context Rot）。以本地文件系统（章节手稿、独立藏书库、角色档案、事实账本）为唯一事实源（Single Source of Truth），Agent 按需调阅、任务执行完即刻释放上下文。
2. **纯文本无污染（Pure Text First）**  
   正文手稿容器绝不掺杂 `#`、`**`、`-` 等 Markdown 标记符号。提供原生符合中文出版规范的排版（段首全角双空格缩进、中文标点规范化），支持一键无损复制至各大连载平台或文字处理软件。
3. **拒绝类型化定性，题材零枷锁（Zero-Trope & Anti-Pigeonholing）**  
   严禁粗暴地给小说贴上“玄幻、科幻、言情”等刻板分类标签，更不将故事套入任何套路公式。设定与资料库采用完全通用的开放卡片结构，绝不强制预设“力量体系、法则境界”等特定概念，让结构由作品本身自由生长。
4. **拒绝流水线垃圾打标，追求文学呼吸感（Organic Literary Pacing）**  
   坚决不用机械脚本（如统计动词密度、感叹号破折号）去给文学段落粗暴贴上“高潮/日常/暗流”等工业流水线标签。叙事节奏的把控完全交由 Agent 内在的文学审美底线（注重克制、白描、生活质感与留白，严禁通篇高亢，避免把每个段落都写成电影高潮预告片）。
5. **主笔构思 + Sub-agent 独立审校（Multi-Agent Review Loop）**  
   写作与评审解耦。主笔生成草稿后，由独立的评判子智能体（文风契合度、史实/设定一致性检查、去 AI 味门禁）进行多维度审读与挑刺，形成透明可采纳的改写建议。

---

## 一、 技术栈选型矩阵 (2026 前沿标准)

| 层次 | 选型 | 选用理由 |
| :--- | :--- | :--- |
| **桌面运行时** | **Electron 35+ + TypeScript 5.8+** | 跨平台稳定运行，全栈统一 TS；Node.js 主进程直连本地文件系统、SQLite 与系统级进程调度。 |
| **工程构建器** | **Vite 6 + electron-vite** | 秒级冷启动与 HMR 热更新，主进程、预加载脚本与渲染进程原生 TypeScript 编译。 |
| **前端界面层** | **React 19 + Tailwind CSS v4** | 现代化并发渲染，Tailwind v4 CSS-first 极速样式引擎；搭配 Lucide Icons 打造沉浸式创作界面。 |
| **状态管理** | **Zustand 5** | 轻量无模板代码，原生支持数据状态持久化与微应用模块化。 |
| **纯文本编辑器** | **定制纯文本编辑器核心** | 严格屏蔽 Markdown 渲染标签；支持全角中文缩进排版、字数统计、划词悬浮菜单与一键标准复制。 |
| **本地检索与存储** | **better-sqlite3 + SQLite FTS5** | 毫秒级中文全文索引，纯本地运行，零额外重型数据库依赖。 |
| **Agent 执行引擎** | **Codex-Style 自研轻量任务运行时** | 任务轮次（Task Turn）内存隔离；流式推理与统一 Tool Call 协议。 |
| **模型协议适配** | **多协议 LLM 适配器 (Multi-Protocol Adapter)** | 原生支持 Chat Completions (`/v1/chat/completions`)、OpenAI Responses (`/v1/responses`) 及 Anthropic Messages (`/v1/messages`) 三大规范；支持动态拉取上游模型列表与手动回退。 |
| **实时网络搜索** | **内置 AnySearch 客户端（嵌入主进程）** | 专注 AnySearch，主进程原生直连，支持网页搜索与正文提取，作为 Agent 主动工具按需调用。 |

---

## 二、 目录架构与独立素材资料库设计 (Directory & Library Architecture)

系统彻底将**「单部小说项目（Project）」**与**「通用外部资料库（Library）」**在物理上完全解耦。

### 1. 全局应用与独立藏书库（`~/.explosion/`）
存放应用全局配置，并作为默认的通用藏书与素材资料库（用户可在设置中自由切换为其他本地目录）：
```text
~/.explosion/
├── config.json                  # 全局应用配置（API Key、选定 Provider、默认模型等）
├── .venv/                       # Python 虚拟环境（供 Agent 运行后台辅助脚本）
├── scripts/                     # 专属轻量运维脚本库
│   └── organize_library.py      # 【核心物理整理脚本】负责将导入的大文本智能拆解为清晰书籍结构
│                                # （Agent 拥有读写权，可根据不同文本特征自主修正脚本代码）
├── library/                     # 【通用外部独立资料库（Library）】（用户可自定义路径）
│   ├── 九州·缥缈录/              # 经脚本整理后拆出的清晰多卷单文件
│   │   ├── 卷一 蛮荒.txt
│   │   ├── 卷二 苍云古齿.txt
│   │   └── 卷三 天下名将.txt
│   ├── 宋史·职官志全篇.txt       # 完整的整本历史考据原始 TXT
│   └── 现代法医学全编.txt       # 完整的整本专业常识原始 TXT
└── cache/                       # 后台全文检索与索引缓存（自动维护，用户不可见）
    └── library_fts.db           # SQLite FTS5 索引缓存
```

### 2. 小说项目目录（`my-novel-project/`）
仅承载本部作品的手稿与专属内生虚构资产，不掺杂任何外部通用资料：
```text
my-novel-project/
├── manuscript/                  # 【正文手稿区】纯文本无污染，按卷/章存放
│   ├── vol_01_起/
│   │   ├── 001_暴雨初歇.txt
│   │   └── 002_长街夜行.txt
│   └── vol_02_承/
│       └── 001_旧案重提.txt
│
├── story/                       # 【本作专属内生资产】（仅属于本故事的人事与推演）
│   ├── characters/              # 本作人物档案（身份、动机、性格、复杂人际关系）
│   │   ├── 主角.txt
│   │   └── 关键配角.txt
│   ├── world/                   # 本作专属虚构构想与剧情推演（核心推演、虚构暗线分析）
│   │   ├── 核心案件逻辑链推演.txt
│   │   └── 家族势力派系暗流.txt
│   ├── outlines/                # 卷纲、主线大纲与滚动细纲
│   │   ├── master_outline.txt
│   │   └── vol_01_detail.txt
│   └── ledger.json              # 动态事实账本（伏笔回收账、时间轴、角色当前生理/持有物追踪）
│
└── .explosion/                  # 【项目元数据】软件自动化维护，用户无须关心
    ├── project.json             # 项目元信息（绑定的模型、挂载的外部资料库路径、最近打开状态）
    └── snapshots/               # 秒级本地时光机快照（防丢稿、误操作无损回滚）
```

---

## 三、 关键机制与交互方案

### 1. 外部大文本的智能整理（Self-Refining Script Workflow）
* **大文件现状**：用户下载的 TXT 往往体积巨大且包含多部作品（如一本包含 6 部的《九州·缥缈录.txt》），格式各异（并非所有文本都有标准“卷-章-节”）；
* **处理机制**：
  * 在 `~/.explosion/scripts/` 中提供专用的 `organize_library.py`，专门负责将混杂文本进行物理拆分与归整；
  * **脚本只做物理拆分，坚决不做任何文学成分或节奏标签划分**；
  * **Agent 自主修正权**：Agent 在整理时先探查文本特征，如果现有切分规则不匹配，**Agent 可主动修改该脚本代码并重新执行**，实现自适应整理；
  * **AnySearch 主动辅助**：整理遇到卷名缺失或模糊时，Agent 可主动调用 `anysearch` 查证标准书目。

### 2. 文学语感把控：由 Agent 审美内核原生驱动
* 摒弃任何由脚本打标（动词统计、标点统计）的流水线假 AI 模式；
* 依托 Agent 对整章原著上下文的深层语义感知，结合严格的**“文学呼吸感门禁”**，在平缓铺垫、日常交流、暗流压抑与高潮决胜之间自如切换，彻底消除通篇堆砌大招名场面的油腻感。

### 3. 多协议支持与首次启动向导（Onboarding）
* 启动无有效配置时主动呼出向导蒙层；
* 支持从上游端点一键拉取可用模型列表（兼容 OpenAI `/v1/models`、Anthropic `/v1/models`、Ollama `/api/tags`），并提供可编辑 Combobox 兼顾手动输入回退；
* 支持将不同模型灵活指派给“主笔”与“Sub-agent 审校”。

---

## 四、 详细演进里程碑 (Milestones)

### 阶段 0：基础工程与框架搭建 (M0 - Foundation)
- [ ] 初始化 `electron-vite` + `React 19` + `TypeScript 5.8+` + `Tailwind CSS v4` 工程骨架。
- [ ] 封装类型安全的主进程与渲染进程 IPC 通信桥。
- [ ] 集成持久化配置系统与首开向导（First-launch Provider Onboarding）：
  - 检测无配置时主动弹窗提示用户配置 Provider。
  - 预设主流模板（DeepSeek、SiliconFlow、Anthropic、OpenAI、Ollama、OpenRouter、自定义）。
  - 统一支持三大主流 API 协议：OpenAI Chat Completions、OpenAI Responses、Anthropic Messages。
  - 上游模型动态拉取与自由输入双模态。
  - 角色模型绑定（主笔 / 审校）。
- [ ] 搭建三栏式核心工作区布局框架。

### 阶段 1：纯文本手稿编辑器与排版系统 (M1 - Pure-Text Editor)
- [ ] 研发专注纯文本的轻量编辑器组件：
  - 严格禁止 Markdown 语法渲染标签（无 `#`、`**`、`>` 污染）。
  - 中文标准排版（段首自动缩进两个全角空格、段落间空行控制）。
  - 中文标点规范化（英文引号、连字符自动映射为规范中文双引号 `“ ”` 和破折号 `——`）。
- [ ] 「一键发布纯文本复制」工具栏与快捷键。
- [ ] 编辑器划词交互系统：选中文本弹出快捷操作（扩写、润色、查证）。
- [ ] 专注写作辅助：
  - 打字机定焦模式（Typewriter Scrolling）。
  - 全屏禅模式（Zen Mode）。
  - 秒级本地增量自动保存。

### 阶段 2：独立资料库与项目解耦 (M2 - Library & Workspace Decoupling)
- [ ] 落地 `~/.explosion/` 全局环境与独立 `library/` 资料库：
  - 设立 `~/.explosion/scripts/organize_library.py` 与 `.venv/`；
  - 赋予 Agent 探查大文件、自主修改脚本并物理拆分图书的能力；
  - 支持直接存放大篇幅、整本原著原始 TXT。
- [ ] 搭建单部小说项目（`my-novel-project/`）结构：
  - `manuscript/`（手稿）、`story/`（人物卡、大纲、剧情推演、动态账本）。
- [ ] 集成 SQLite FTS5 本地全文索引（在 `~/.explosion/cache/` 中自动维护）。

### 阶段 3：Codex-Style Agent 运行时与联网搜索 (M3 - Agent & Search Engine)
- [ ] 构建 Node.js 主进程 Agent 执行引擎：
  - 多协议统一适配器，全协议支持流式（SSE）与 Tool Call。
  - 基于 Task Turn 的上下文精准装配（按需注入，执行完即释放，防腐烂）。
- [ ] 交互控制与成本监控：
  - 流式生成随时中断（AbortController 毫秒级打断）与一键热重试。
  - Token 与预估成本透明监控面板。
- [ ] 嵌入实时搜索能力（Embedded AnySearch Tool）：
  - 主进程原生直连 AnySearch，免 Key 匿名开箱可用，支持 API Key 配置。
  - 作为 Agent 主动调用的原生 Tool，在整理书目或写书查证时按需使用。

### 阶段 4：Sub-agent 评判与审校工作流 (M4 - Sub-agent Review Matrix)
- [ ] 实现评审流水线：主笔生成候选段落 -> 触发并发审查。
- [ ] 落地三大 Sub-agent 审校器：
  - **Style Critic**：文风拟合度与语言质感评审。
  - **Consistency Inspector**：吃书检测与设定矛盾核对。
  - **De-AI Guard**：黑名单句式拦截与动作化（Show don't tell）改写建议。
- [ ] 创作辅助与视角守护：
  - 剧情分叉推演（Multi-Roll / 走向抽卡）。
  - POV 叙事视角锁定守护（严防限定视角越界）。
- [ ] 交互式 Diff 与替换卡片：在右侧面板并列展示评审意见与改写方案，支持一键采纳。

### 阶段 5：进阶创作生态与体验优化 (M5 - Polish & Ecosystem)
- [ ] 树状大纲系统：卷-章-节树状结构，支持滚动式动态细纲规划。
- [ ] 本地安全快照与 Git 版本历史：每次章节保存自动生成快照，支持任意历史回滚。
- [ ] 导出套件：无损纯文本导出、EPUB 电子书打包、PDF 排版导出。
- [ ] 性能与体验打磨：多窗口支持、快捷键全键盘操作、暗夜专注模式。
