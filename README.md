# Explosion

> 拒绝工业糖精，本地优先、零 Markdown 污染的现代化中文 AI 小说创作桌面工作台。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org/)
[![pnpm Version](https://img.shields.io/badge/pnpm-10%2B-orange.svg)](https://pnpm.io/)
[![Electron](https://img.shields.io/badge/Electron-35-47848F.svg)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

![Explosion 创作工作台预览](./docs/screenshot.png)

---

## 项目定位

现存大多数 AI 写作工具普遍存在两大核心痛点：一是将大语言模型简单封装为单轮流水线或依赖自动压缩的长会话，随着字数增长不可避免地出现上下文腐烂、人物设定漂移与剧情“吃书”；二是强行在正文混杂 Markdown 标记或预设僵化的网文套路标签，破坏纯粹的中文排版体验与文学呼吸感。

**Explosion** 专为中长篇严肃小说创作设计，秉承以下核心理念：

1. **以文件为唯一事实源（File as Source of Truth）**  
   手稿直接读写本地纯文本文件（`.txt`），不经过中间专有数据库劫持。Agent 采用以 Task Turn 为周期的轻量执行模型，按需调阅设定与资料，任务执行完毕即刻释放长上下文，从根本上杜绝上下文腐烂（Context Rot）。
2. **零 Markdown 污染的纯文本排版（Pure Text First）**  
   正文手稿容器严格杜绝 `#`、`**`、`-` 等符号污染，原生支持段首全角双空格缩进、中文标点规范化（智能转换引号与破折号）、实时字数与预计阅读时间统计，并支持一键复制出版级纯文本。
3. **独立素材资料库与小说项目物理隔离（Library & Project Decoupling）**  
   - **全局藏书资料库（Library）**：统一存放在 `~/.explosion/library/`，支持整本原始原著 TXT 导入与物理智能拆解，内置 768 维语义向量与 SQLite FTS5 文学级 Hybrid RAG 检索。
   - **小说项目工作区（Project）**：仅包含章节手稿（`manuscript/`）、本作专属内生设定（`story/`，涵盖大纲规划、人物档案、暗线推演与事实账本）及本地时光机快照（`.explosion/snapshots/`）。
4. **多 Agent 协同审校与静默去 AI 味（Sub-Agent Review & Silent Guardrails）**  
   由主 Agent 驱动的 Sub-agent 审校体系（文风拟合度 Style Critic、设定一致性 Consistency Inspector、去 AI 味 De-AI Guard），毫秒级拦截辩证排比与空洞微表情套话，落实白描、具象动作化（Show don't tell）与自然留白。
5. **多协议大模型统一适配（Multi-Protocol LLM Adapter）**  
   原生支持 OpenAI Chat Completions、OpenAI Responses 与 Anthropic Messages 三大规范，支持动态拉取上游模型列表与单一主力模型驱动。

---

## 核心功能清单

| 模块 | 功能特性 | 说明 |
| :--- | :--- | :--- |
| **纯文本编辑器** | 零 Markdown 污染容器 | 编辑器核心为纯文本，绝不渲染 Markdown 标记，保障纯粹的执笔手感。 |
| | 中文出版排版规范 | 一键规范排版：段首自动缩进两个全角空格、段落空行归一、标点符号规范化（`“ ”`、`——`）。 |
| | 一键出版级纯文本复制 | 过滤多余换行与脏字符，一键复制符合连载平台与出版格式的纯文本到系统剪贴板。 |
| | 划词悬浮菜单与局部改写 | 在手稿中选中文本即刻弹出悬浮菜单，定向指派 Agent 进行局部扩写、润色、查证与精准重构。 |
| | 本地时光机快照回滚 | 章节保存自动沉淀增量快照，提供时光机抽屉进行历史版本查看与无损回滚，杜绝误操作与丢稿。 |
| **独立资料库** | 原著导入与物理切分 | `organize_library.py` 负责长篇原著的卷目拆分与结构化归整，严禁机械文学打标。 |
| | 768 维 + FTS5 Hybrid RAG | 结合本地 768 维向量与 Node 内置 `node:sqlite` FTS5 倒排索引，采用 RRF 算法毫秒级检索原著段落与意境，支持无向量环境优雅降级。 |
| | `@` 联想引用系统 | 在右侧 Agent 对话框输入 `@`，可实时联想并挂载资料库书目分卷，作为精准上下文注入。 |
| **Agent 执行引擎** | Task Turn 隔离上下文 | 按需注入参考材料，任务完成后释放会话缓存，保持上下文常新。 |
| | 多协议 LLM 适配器 | 原生对接 `/v1/chat/completions`、`/v1/responses` 与 `/v1/messages`，覆盖主流闭源与开源模型。 |
| | 嵌入式 AnySearch | 主进程直连 AnySearch 客户端，支持实时联网检索与网页正文提取，无需配置额外复杂 API Key。 |
| | Sub-agent 审校矩阵 | 主笔生成后触发文风拟合、设定防吃书与 De-AI 检查，右侧展示建议与 Diff 采纳卡片。 |
| | 静默去 AI 味门禁 | 内置毫秒级规则引擎，严格拦截“不是……而是”、“空气仿佛凝固”、“嘴角勾起弧度”等典型 AI 辩证套话与悬浮表情。 |

---

## 技术栈

- **桌面运行时**：`Electron 35+` / `Node.js 24+` / `TypeScript 5.8+`
- **构建工具**：`Vite 6` / `electron-vite 5`
- **前端框架**：`React 19` / `Tailwind CSS v4` / `Zustand 5` / `Lucide React`
- **本地存储与索引**：本地纯文本（`.txt`）文件系统 + Node 内置 `node:sqlite`（SQLite FTS5 全文倒排索引）
- **多模型适配**：自研多协议抽象层（OpenAI Chat Completions、OpenAI Responses、Anthropic Messages）
- **网络搜索**：内置主进程 AnySearch 客户端
- **测试框架**：`Vitest 3`

---

## 快速开始

### 环境依赖

- **Node.js**：`24.0.0` 或更高版本（必须支持原生 `node:sqlite` 模块）
- **包管理器**：`pnpm` `10.0.0` 或更高版本
- **Python**（可选，用于资料库 768 维语义向量嵌入）：Python 3.10+。若未配置 Python 虚拟环境，系统将自动平滑回退至纯 FTS5 毫秒级全文索引，所有功能均可正常使用。

### 安装与启动

1. **克隆仓库**
   ```bash
   git clone https://github.com/Lingbou/Explosion.git
   cd Explosion
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **启动桌面开发环境**
   ```bash
   pnpm dev
   ```

4. **代码校验与自动化测试**
   ```bash
   # 执行自动化测试套件
   pnpm test

   # 执行 TypeScript 类型检查
   pnpm typecheck

   # 执行生产打包构建
   pnpm build
   ```

---

## 模型与 Provider 配置

首次启动应用时，系统会自动弹出 Provider 配置向导；亦可随时点击工作区右上角齿轮图标进入「设置」面板进行修改。

Explosion 采用**单一主力模型全局驱动**架构，主笔与并发 Sub-agent 共享同一模型，通过系统提示词与隔离上下文各司其职，避免为不同角色绑定不同模型的复杂配置负担。

### 支持协议与预设模板

| 预设 Provider | 默认协议类型 | 默认端点示例 | 说明 |
| :--- | :--- | :--- | :--- |
| **DeepSeek** | OpenAI Chat Completions | `https://api.deepseek.com/v1` | 兼容 `/v1/chat/completions` 与 `/v1/models` |
| **SiliconFlow** | OpenAI Chat Completions | `https://api.siliconflow.cn/v1` | 硅基流动平台，汇聚主流开源长上下文模型 |
| **OpenAI** | OpenAI Chat Completions / Responses | `https://api.openai.com/v1` | 支持标准 Completions 与新版 Responses 协议 |
| **Anthropic** | Anthropic Messages | `https://api.anthropic.com/v1` | 支持 Claude 系列的 `/v1/messages` 规范 |
| **Ollama** | OpenAI Chat Completions | `http://localhost:11434/v1` | 本地私有化大模型运行，支持自动拉取已下载模型列表 |
| **OpenRouter** | OpenAI Chat Completions | `https://openrouter.ai/api/v1` | 聚合各类顶级推理模型 |
| **自定义** | 任选三大协议之一 | 自定义 URL 与端点路径 | 支持任意符合以上协议规范的反向代理或第三方服务 |

> **提示**：配置 API Key 与端点后，点击模型输入框旁的「获取列表」按钮可直接拉取上游端点返回的模型清单；同时支持在 Combobox 中手动输入任意模型名称。

---

## 目录结构

```text
Explosion/
├── resources/                   # 桌面应用图标与静态素材 (icon.png, icon.svg)
├── docs/                        # 说明文档与界面截图
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── agent/               # Agent 执行引擎 (Runner, Sub-agent Manager, Prompts, Tools)
│   │   │   ├── guardrails/      # 静默去 AI 味与叙事门禁 (Silent Guardrails)
│   │   │   └── tools/           # Agent 原生工具 (文件读写、资料检索、Web 搜索等)
│   │   ├── config/              # 全局配置管理与持久化 (~/.explosion/config.json)
│   │   ├── ipc/                 # 主进程 IPC 通信处理器注册
│   │   ├── library/             # 独立资料库管理与 organize_library.py 脚本
│   │   ├── llm/                 # 多协议 LLM 适配器 (Chat Completions / Responses / Messages)
│   │   └── project/             # 小说工程管理与时光机快照系统
│   ├── preload/                 # Electron 预加载脚本 (类型安全 IPC Bridge)
│   ├── renderer/                # React 19 渲染进程 (工作台界面)
│   │   ├── src/
│   │   │   ├── components/      # UI 组件 (EditorCenter, LeftSidebar, RightPanel, Modals)
│   │   │   ├── lib/             # 中文排版引擎 (typography) 与划词处理
│   │   │   └── store/           # Zustand 状态管理 (workspace, agent, config, library)
│   │   └── index.html           # 渲染主页面
│   └── shared/                  # 主进程与渲染进程共享类型与工具函数
├── tests/                       # Vitest 自动化测试套件
├── ROADMAP.md                   # 详细产品演进里程碑
├── AGENTS.md                    # Agent 开发规范与工程工作流约束
└── package.json
```

### 全局运行时目录（`~/.explosion/`）

在用户本地主目录下，Explosion 维护统一的数据与缓存目录：

```text
~/.explosion/
├── config.json                  # 全局应用配置 (Provider、API Key、默认模型)
├── library/                     # 默认通用藏书资料库 (存放整本原始原著 TXT)
├── scripts/                     # 自动化脚本 (organize_library.py，Agent 具备自修与执行权)
├── .venv/                       # Python 虚拟环境 (供向量嵌入与文本处理使用)
└── cache/                       # 资料库全文倒排索引与向量缓存 (index.db)
```

### 单部小说项目结构（`my-novel-project/`）

```text
my-novel-project/
├── manuscript/                  # 【小说正文手稿】（直接读写磁盘纯文本，无中间数据库）
│   ├── 001_引子.txt
│   └── 002_长街夜行.txt
├── story/                       # 【本作专属内生设定】
│   ├── characters/              # 人物档案（身份、动机、性格、复杂人际关系）
│   ├── world/                   # 虚构构想与剧情推演（核心推演、暗线分析）
│   ├── outlines/                # 卷纲、主线大纲与滚动细纲
│   └── ledger.json              # 动态事实账本（伏笔账本、时间轴、状态追踪）
└── .explosion/                  # 【项目元数据】（软件自动维护）
    ├── project.json             # 项目元信息
    └── snapshots/               # 秒级本地时光机快照（增量备份、无损回滚）
```

---

## 开发规范与协作

本项目遵循严格的敏捷工程约束与架构原则：

- **破坏性重构优先（Zero Backward Compatibility Burden）**：敏捷初期杜绝为历史兼容保留过渡层，一旦发现更优设计直接重构。
- **全流程 Worktree 隔离开发**：禁止直接在主分支提交代码；所有任务严格遵循 `[Issue] ➔ [Worktree in .temp/] ➔ [PR] ➔ [Merge] ➔ [Clean]` 标准流程。
- **规范指引**：参与开发前，请务必详阅 **[AGENTS.md](./AGENTS.md)**。

---

## 开源协议

本项目采用 [MIT 许可证](./LICENSE) 开源。
