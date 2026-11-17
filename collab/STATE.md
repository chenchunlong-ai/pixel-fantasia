# STATE — 项目状态板

> 只写“当前状态”，不写历史（历史在 `journal/`）。
> 每次提交后更新一次；谁改谁负责更新自己那几行。

## 当前版本

| 项 | 值 |
| --- | --- |
| 版本（`version.mjs` 唯一源） | `1.0.0.0`（商店已提交待审） |
| 下一次发行版本 | `1.0.1.0`（未定日期） |
| 构建产物（2026-11-18 02:04 重建） | `PixelPalette.exe` 450.5 KB / `PixelPalette-Setup.exe` 742.0 KB / `4A5AB34E.62945D70D0F14_1.0.0.0_x64.msix` 771.5 KB / `app.zip` 588.8 KB |
| 验证状态 | `build.mjs` **通过**、`verify.mjs` **通过**（`all scenes ok`），2026-11-18 实测 |
| git HEAD | `fd48091` 2026-11-18 feat(about): 关于页加「复制制作提示词」按钮（其后紧跟本次状态板提交） |

## 正在进行的改动（在飞）

| Agent | 任务 | 锁定的路径 | 开始时间 | 预计结束 |
| --- | --- | --- | --- | --- |
| （空） | | | | |

> 与 `collab/locks/` 不一致时，以 locks 目录为准，并回头修这张表。

## 最近 3 条

1. 2026-11-18 · `fd48091` · 豆包 · 关于页新增「复制制作提示词」按钮：SKILL.md 全文 + 壁纸/桌宠填空模板直接进剪贴板，9 语言配套文案（`src/settings.html` +5、`src/settings.js` +29、`src/i18n.json` +81、`shell/Program.cs` +14、`shell/Lang.Generated.cs` +81 自动生成）
2. 2026-11-18 · `c22608f` · 豆包 · 引入双 AI 协作契约：`AGENTS.md` + `collab/`（STATE、journal 模板、锁/日志/提交三脚本），`.gitignore` 追加白名单放行
3. 2026-11-15 · 首个公开版本 1.0.0.0 提交商店（WACK 25/25）

## 下一步（已拍板未开工）

- [ ] **人工验收**：启动 `out\PixelPalette.exe` → 设置 → 关于 → 点「复制制作提示词」→ 粘到记事本，应看到约 8 KB 完整规范；同时确认按钮与下方提示排版没串行
- [ ] 商店字段：9 语言 Short description、Keywords、App features 录入 Partner Center（定稿在 `D:\AAAAA\ShiPin\1\about-prompt\商店短语-9语言与配套字段.md`）
- [ ] 内容扩充：从引擎 244 个效果里挑选可当全屏壁纸的（nature / water / fire / scifi 优先）
- [ ] 打赏：Microsoft Store 消耗型附加组件（¥6 / ¥18），等 1.0.0.0 过审后开工
- [ ] 鼠标交互（雪随气流）：外壳 GetCursorPos 轮询 → 现有 Push 通道
- [ ] Gitee 镜像：建成后填 `REPO_URLS.gitee`
- [ ] 对外文档修正：README 里的 Setup 体积（515 KB）与实况（742 KB）不符；MSIX 写 0.4 MB 而实况 771.5 KB

## 需要人类裁决的事

| 日期 | 事项 | 提出者 |
| --- | --- | --- |
| 2026-11-18 | `AGENTS.md` 目录所有权表仍是占位角色：谁当“内容方”（`src/scenes/`、`src/fx/`、`src/pets.js`）、谁当“外壳方”（`shell/`、`palette-wallpaper/*.mjs`） | 豆包 |
| 2026-11-18 | 本次改动跨了「双签区（`src/`）」与「外壳区（`shell/`）」，是否请外壳方复核 `PushSkillText()` 后再提交商店 | 豆包 |
| 2026-11-18 | 是否随下一次发行升版本到 `1.0.1.0` 并补 What's new | 豆包 |

## 约定

- 改这个文件也要先声明锁（它属于双签区）。
- “最近 3 条”只保留最新三条，多的删掉——历史在 journal 里，不会丢。
- **注意**：本仓库 `.gitignore` 是白名单式（首行 `*` 全忽略）。新建任何要入库的文件，必须在 `.gitignore` 末尾补 `!路径` 放行，否则 `git add` 会被拒绝。
