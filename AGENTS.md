# AGENTS.md - Explosion 开发与协作规范

本文档为所有在 Codex 或外部会话中参与 **Explosion** 项目开发的人类与 AI Agent 设定强制性工作流、工程约束与架构原则。

---

## 零、 核心开发哲学

1. **破坏性重构优先（Zero Backward Compatibility Burden）**  
   本项目处于敏捷初期（Pre-1.0），**严禁为了历史向后兼容保留陈旧代码、冗余 shim、过渡层或废弃 API**。一旦发现更优设计，直接做干净利落的破坏性重构（Breaking Changes），一切以当前最清晰、最健壮、最前沿的架构为唯一标准。
2. **零垃圾留存（Zero Garbage Left Behind）**  
   所有临时产物必须收敛于 `.temp/` 目录。每次任务交付后，必须彻底清理本地临时分支与 worktree，保持主工作区绝对整洁。

---

## 一、 标准任务开发工作流 (Standard Workflow)

无论是进行功能开发、Bug 修复还是架构重构，**必须**严格遵循以下全流程：

```text
[创建 Issue] ➔ [在 .temp/ 中创建 Worktree] ➔ [在 Worktree 中开发测试] ➔ [提交并推流] ➔ [创建 PR 并合并] ➔ [主分支拉取] ➔ [彻底清理 Worktree]
```

### 步骤 1：在 GitHub 创建对应 Issue
在开始写任何业务代码前，先创建明确的任务 Issue：
```bash
gh issue create --title "<类型>: <清晰描述>" --body "<背景、目标与实现计划>"
# 记录返回的 Issue 编号，例如 #1
```

### 步骤 2：在 `.temp/` 目录下创建独立 Git Worktree
严禁直接在主仓库根目录切换分支开发。统一在 `.temp/` 下开辟隔离的 worktree：
```bash
# 确保在仓库主分支根目录
git checkout main
git pull origin main

# 分支命名规范：feat/issue-1-description 或 fix/issue-2-description
BRANCH_NAME="feat/issue-<编号>-<简短名>"

# 在 .temp/ 下创建对应 worktree
mkdir -p .temp
git worktree add ".temp/${BRANCH_NAME}" -b "${BRANCH_NAME}"
cd ".temp/${BRANCH_NAME}"
```

### 步骤 3：在 Worktree 中完成开发与本地验证
在 `.temp/${BRANCH_NAME}` 目录下执行编码、单测、类型检查与构建验证：
```bash
# 进入 worktree 目录
cd /home/lingbou/WorkSpace/github/Explosion/.temp/${BRANCH_NAME}

# 提交代码（严格规范的 Commit Message）
git add .
git commit -m "<type>(scope): <subject>"

# 推送分支至 GitHub
git push -u origin "${BRANCH_NAME}"
```

### 步骤 4：在 GitHub 创建 Pull Request
```bash
gh pr create --title "<type>(scope): <subject>" --body "Closes #<编号>\n\n<实现细节与验证结果>"
```

### 步骤 5：PR 合并与主仓库更新
PR 经过审查/合并后，切回主仓库目录同步最新代码：
```bash
cd /home/lingbou/WorkSpace/github/Explosion
git checkout main
git pull origin main
```

### 步骤 6：清理 Worktree 与本地临时分支（清理垃圾）
合并完成后，必须彻底删除 worktree 和本地临时分支，释放磁盘空间并防止垃圾残留：
```bash
# 强制移除 worktree
git worktree remove --force ".temp/${BRANCH_NAME}"

# 删除本地临时分支
git branch -D "${BRANCH_NAME}" 2>/dev/null || true

# 检查 worktree 状态确保清理干净
git worktree list
```

---

## 二、 分支与提交规范 (Branch & Commit Conventions)

### 1. 分支命名规则
* **严禁使用 `codex/` 等特定工具前缀**。
* 必须使用通用的业界语义化前缀，格式为：`<type>/<issue-编号>-<简短描述>`：
  * `feat/issue-1-project-scaffold`（新功能）
  * `fix/issue-2-editor-overflow`（Bug 修复）
  * `refactor/issue-3-llm-adapter`（无逻辑改变的结构重构）
  * `chore/issue-4-update-deps`（配置、依赖、构建脚本调整）
  * `docs/issue-5-update-specs`（文档与规范编写）

### 2. Commit Message 规范
严格遵循 **Conventional Commits** 规范，格式：`<type>(<scope>): <subject>`：
* `feat`: 新增业务功能
* `fix`: 修复缺陷
* `refactor`: 重构代码（不改变外部行为）
* `docs`: 文档变动
* `chore`: 构建配置、依赖管理
* `perf`: 性能优化
* `test`: 增加或修改测试
* 示例：
  * `feat(provider): implement multi-protocol llm streaming adapter`
  * `fix(editor): prevent newline duplication on paste`
  * `refactor(search): extract anysearch rest client to core module`

---

## 三、 目录与环境隔离规范

### 1. `.temp/` 目录规范
* 路径：`$PROJECT_ROOT/.temp/`
* 用途：
  * Git Worktree 独立开发目录（如 `.temp/feat/issue-1-...`）；
  * 调试日志、中间测试产物、实验性原型脚本、临时文件。
* 规则：
  * `.temp/` 已被全局加入 `.gitignore`，**严禁将其提交至 Git**；
  * 定期保持 `.temp/` 内部无长期孤立 worktree。

---

## 四、 架构设计与代码底线 (Code Guardrails)

1. **技术栈锁定**：
   * 桌面端：`Electron 35+` + `TypeScript 5.8+` + `Node 24+`；
   * 构建工具：`electron-vite` + `Vite 6`；
   * 渲染端：`React 19` + `Tailwind CSS v4` + `Zustand 5` + `Lucide React`；
   * 本地存储：本地文件系统作为唯一事实源（Markdown/纯文本/JSON）+ `better-sqlite3`（FTS5 全文搜索）。
2. **正文输出零 Markdown 污染**：
   * 小说正文手稿容器必须为纯文本，严禁渲染或写入 `#`、`**`、`-` 等格式标记；
   * 提供符合中文排版规范的纯文本复制能力（段首全角双空格缩进、中文引号规范）。
3. **上下文防腐烂（Anti-Context Rot）**：
   * 严禁依赖单一长会话自动压缩；
   * 采用以文件为中心（File-backed）的任务执行轮次（Task Turn），按需注入参考资料与状态，任务完成后即刻释放长上下文。
4. **LLM 与搜索集成规范**：
   * LLM 客户端：多协议统一抽象适配器（支持 `Chat Completions`、`OpenAI Responses`、`Anthropic Messages` 三大规范）；
   * 联网搜索：专注于内置主进程 `AnySearch` 客户端，不引入多余冗余搜索接口；搜索结果支持一键沉淀为 `references/lore/` 设定卡。
5. **拒绝标签化与模式绑架（Anti-Pigeonholing & Flexible Schema）**：
   * 严禁在界面、数据结构或 Prompt 中强行给小说分类定性（如强制要求选择“科幻/玄幻/言情”）；
   * 严禁在参考资料库中硬编码“力量体系/境界法则”等特定网文产物；所有资料卡、人物卡均为完全开放、自由组织的通用文本/键值，让结构由作品本身按需决定。

6. **项目与通用资料库物理彻底隔离（Separation of Project and Library）**：
   * 严禁将通用参考资料混入单部小说的项目目录中：
     * **独立素材资料库（Library）**：用户可自由选择本地任意文件夹（默认 `~/.explosion/library/`），直接存放大篇幅、整本原著的完整原始 `.txt` 文件。由 `~/.explosion/scripts/organize_library.py` 负责纯物理层面的拆分与归整（严禁用脚本进行任何机械的文学成分或节奏标签打标），Agent 拥有根据文本特征自主修改和优化该脚本的权限；
     * **单部小说项目目录（Project）**：只包含正文手稿 `manuscript/`、本作专属内生设定 `story/`（人物档案、大纲、剧情推演、伏笔账本）以及元数据 `.explosion/`；
     * **全局应用目录**：统一收敛在 `~/.explosion/`（全局配置 `config.json`、默认资料库 `library/`、脚本 `scripts/` 与 `.venv/`、索引缓存 `cache/`）。
