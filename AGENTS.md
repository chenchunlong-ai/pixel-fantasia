# AGENTS.md — 协作契约（像素幻境 / Pixel Fantasia）

> 本文件是这个仓库的**唯一协作契约**。任何 AI（豆包、Claude、Codex、Cursor、Copilot 或其他）
> 动手前必须先读完本文件；人类维护者同样按此执行。
>
> 一句话：**同一份 git 历史，各自的工作目录，每一处改动都必须留下“为什么”。**

---

## 0. 开工前必做三件事

1. **读根目录 `HANDOVER.md`**：一页纸，项目是什么、现在在哪、未完成什么、硬规矩、环境坑、已拍过的板。**路径只给这一句就够，读完它再决定是否往下读。**
2. 读 `collab/STATE.md`：当前版本、正在进行的改动、下一步。
3. 读 `collab/journal/` 最近 3 条：别人刚改了什么、为什么。

没做这三步就开始改文件，视为违规改动。**收工时必须回头更新 `HANDOVER.md` 的「现在在哪」「未完成」两节**——过期信息比没有信息更坏。

---

## 1. 目录所有权（第一道防线，比加锁更有效）

先划清“谁的地盘”，再谈锁。跨区改动必须在 journal 里标注“跨区”。

| 区域 | 归属 | 说明 |
| --- | --- | --- |
| `palette-wallpaper/src/fx/**`、`src/scenes/**`、`src/effects.js`、`src/palettes.js` | **内容方** | 场景、特效、调色板；最常改的区域 |
| `palette-wallpaper/shell/**`、`build.mjs`、`msix.mjs`、`icon-assets.mjs`、`version.mjs`、`app.manifest` | **外壳方** | C# 外壳、构建脚本、商店包、版本号 |
| `palette-wallpaper/src/settings.html/js`、`runtime.html/js`、`i18n.json`、`pets.js`、`params.js` | **双签区** | 改动前必须在 journal 写明并同步另一方 |
| `src/**`（仓库根的引擎） | **只读** | patch-gg/pixelfx 原装引擎，不改上游文件 |
| `docs/**`、`CHANGELOG.md`、`README*.md`、`privacy.html` | **双签区** | 对外承诺，改前确认事实 |
| `palette-wallpaper/skill/**` | **双签区** | 对外发布的制作范式 |
| `out/**`、`node_modules/**` | **产物/依赖** | 不提交、不手改、不作为改动证据 |

**谁是内容方、谁是外壳方由人类维护者指定**；未指定时按上表默认，冲突由人类裁决。

---

## 2. 五条硬规则

1. **先声明，再动手**：改任何文件之前，在 `collab/locks/` 放下自己的锁（用 `claim.ps1`）。目录锁覆盖整棵子树。
2. **只追加，不自改**：`collab/journal/` 里只能新增**自己的**条目，**永远不要修改或删除别人的条目**。
3. **一次提交一个理由**：提交信息必须包含 `Why:` / `Files:` / `Agent:` 三个字段（用 `commit.ps1` 自动生成，别手写糊弄）。
4. **不动别人的锁**：锁未过期且持有人不是你 → 停手。要么换文件，要么在 journal 里留言等对方释放。抢过期锁可以，但必须在 journal 写明“接手了谁的过期锁”。
5. **禁止破坏性 git**：不 `push --force`、不 `reset --hard`、不 `clean -fd`、不 rebase 别人已发布的分支。删文件前确认它是不是别人的在建工作。

---

## 3. 三个文件的格式（不要自创格式）

### 3.1 锁：`collab/locks/<路径转义>.json`

```json
{
  "path": "palette-wallpaper/src/effects.js",
  "agent": "豆包",
  "task": "内容扩充：接入 nature 场景",
  "since": "2026-11-18T01:05:00+08:00",
  "ttlHours": 4,
  "expires": "2026-11-18T05:05:00+08:00"
}
```

- 路径转义规则：`\ / : * ? " < > |` 一律替换为 `~`。由 `claim.ps1` 自动处理，别手写文件名。
- `ttlHours` 默认 4 小时。过期锁可被抢。
- **目录锁生效于整棵子树**：锁 `palette-wallpaper/src` 等价于锁它下面所有文件。

### 3.2 变更日志：`collab/journal/YYYY-MM-DD-HHMM-<agent>-<slug>.md`

固定四段，每段一句话，宁短不长：

```markdown
# 接入 nature 场景（第 1 批）
- **Agent**: 豆包  **Task**: 内容扩充  **时间**: 2026-11-18 01:05

## 改动
src/effects.js 增 6 条注册；新增 src/scenes/_nature.js

## 原因
内容单薄是第一短板：引擎已有 244 个效果，只暴露了 21 个

## 影响
场景 21 → 27；需重跑 build.mjs；商店包版本不变，改版时随 1.0.1.0 一起发

## 验证
verify.mjs 通过；未跑目检（本机缺 node 图标依赖，原因：xxx）
```

### 3.3 提交信息

```
type(scope): 摘要（不超过 60 字，说做了什么）

Why: 为什么做（一句话，说动机而不是过程）
Files: 主要涉及的文件（逗号分隔，可写目录）
Agent: 谁做的
Task: 对应哪项任务（可选）
Journal: collab/journal/xxx.md（可选，建议填）
```

`type` 取值：`feat` / `fix` / `docs` / `refactor` / `build` / `chore`。

---

## 4. 协作的两种形态

**A. 串行（默认，推荐给本项目）**
同一个工作目录，靠“锁 + journal”排队。两个 AI 不会同时写同一个文件，但共享同一份工作区和构建环境。
适合：改动小、需要立刻看到构建结果、只有一个 AI 在线。

**B. 并行（各在各的目录）**
```powershell
git worktree add D:\aaa\wt-豆包 -b 豆包/nature-scenes
git worktree add D:\aaa\wt-另一个 -b 另一个/shell-fix
```
- 各自目录、各自分支、共享同一份 `.git` 历史，物理上不可能互相覆盖。
- 完成后由人类（或指定的一方）`git merge`。
- worktree 内要单独 `npm install`；`node_modules`、`out` 不复制。
- 代价：构建产物、截图、测试环境各一份，磁盘和心智负担翻倍。

**判断标准**：两个 AI 会不会在同一小时内改同一个文件？会 → 用 B；不会 → 用 A 就够。

---

## 5. 验证纪律

改动完成后，最低限度跑：

```powershell
node palette-wallpaper/verify.mjs        # 场景能画、换色有效
```

涉及外壳、构建脚本、商店包时，再加：

```powershell
node palette-wallpaper/build.mjs         # 产出 exe / Setup / MSIX
```

跑不了（缺 node、缺图标依赖、环境不允许）时，**必须在 journal 的“验证”一栏写明“未跑 + 原因”**。
没写验证结果 = 这次改动视为未完成，下一个人接手前要先复核。

---

## 6. 冲突与违规处理

| 情况 | 怎么做 |
| --- | --- |
| 文件被改了，但 journal 里没有对应条目 | 视为违规改动。停手，写进 `collab/STATE.md`，等人类裁决；**不要自行回滚别人的改动** |
| 锁过期了，你接手 | 可以改，但在 journal 里写明“接手 XX 的过期锁，原因是……” |
| 改到一半发现要动别人的区域 | 先在 journal 留言，再等对方释放锁；别“顺手一起改” |
| 两个 AI 的改动在语义上冲突（都能编译，但逻辑打架） | 后改的一方负责合并；在 journal 里写清“合并了谁的什么改动” |
| 拿不准 | 停在只读状态，把问题写进 journal，等人类决定 |

---

## 7. 已知的项目红线（改之前先看一眼）

- `version.mjs` 是**唯一版本号源**，只有外壳方改；商店更新必须递增。
- `src/**` 引擎文件**一行不改**，所有改造都在 `palette-wallpaper/src/**` 里做包装。
- 用户壁纸走 `srcdoc iframe`，不要改回 `wp.local`（历史坑）。
- `shot.mjs` 产出的 PNG，CRC 是错的，需 python 重算后 PIL 才能读。
- MSIX 的 `Identity Name` 必须与商店预留名一致（`4A5AB34E.62945D70D0F14`）。
- `out/` 里混着临时目录（`新建文件夹`、`_grid*.png`），**上传商店前确认包的时间戳**，别拿错。
