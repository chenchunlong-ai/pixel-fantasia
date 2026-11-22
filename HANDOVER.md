# HANDOVER.md — 开工前只读这一个

> 换 AI、换人、隔了几天回来，都从这里开始。读完这一页就能直接动手。
> **规矩：每次收工时，本文件的「现在在哪」「未完成」两节必须改成最新事实。**（过期信息比没有信息更坏）

---

## 0. 开工先跑这三条命令（别只信本文档）

```
git status
git log --oneline -10
git diff --stat
```

有未提交改动再 `git diff`。

**先汇报你看到的当前状态，再动手。** 本文档可能比仓库落后——文档会忘更新，git 不会撒谎。两者冲突时，**以 git 为准**，并把本文档补正后再干活。
（本机 git 不在 PATH：用 `D:\AI,GPT\Git\cmd\git.exe`）

一句话纪律：**这是接力项目，不是从零开始。不要重做已完成部分，不要改无关文件；改完把「为什么」和「验到什么数字」写下来，否则下一个人只能猜。**

## 1. 这是什么

| 项 | 值 |
| --- | --- |
| 产品 | 像素幻境 / Pixel Fantasia —— Windows 动态壁纸软件，可装自制壁纸与像素桌宠 |
| 发行 | 迷游兔工作室，GPL-3.0，**免费开源、离线、不收集信息** |
| 仓库 | `D:\aaa\2D动效pixelfx`（引擎根）；产品在 `palette-wallpaper\` |
| 人类工作目录 | `D:\AAAAA\ShiPin\1`（知识包 `skill\`、产物 `work\`、`about-prompt\`、`collab-kit\`） |
| 商店 | Store ID `9NZV5LCNMW9F`，Identity `4A5AB34E.62945D70D0F14`，已提交待审 |
| 版本 | `palette-wallpaper\version.mjs` = **`1.0.2.1`**（**唯一版本源**，只有发行才改） |
| 构建 | `node palette-wallpaper/build.mjs` → 产物在 `out\`（exe/setup/msix/app.zip） |
| 启动测试 | **`out\msix\PixelPalette.exe`**（`out\` 根缺 dll，从那里启动必崩） |
| 数据目录 | `%LOCALAPPDATA%\PixelPalette`（`settings.json` / `wallpapers` / `pets` / `webview` / `log.txt`） |

---

## 2. 现在在哪（2026-11-21 15:29）

- **2026-11-23**：流星黑烟根因=配色数组缺 C[4]（工艺代码用到）→undefined 画成黑；全换 6 色 ramp。星星按用户精确档位重做（1 块 3 阶 / 十字 5 块臂 3 阶 / 十字 9 块外扩波）。**教训：大段索引替换切坏过 heaven（drawBack/draw 丢失），verify 抓到后 git 恢复+唯一锚点重做**
- **2026-11-22 深夜二**：新共享模块 `src/fx/meteors.js`（流星系统，shooting-stars 工艺移植+循环分数调度，8 颗/循环全不同）接入 heaven/rift/otherworld-rift；heaven 星星亮星改 q.circle 圆盘、色调保留、闪烁放慢。版本 1.0.2.8，MSIX 已产出。**教训：harness 目检必须 fresh bundle+唯一文件名（见 23:20 journal）**
- **2026-11-22 深夜**：sandstorm 飞线补刀（_tornado wind() 加 noWind，上轮漏网）+落沙加量；heaven 星空按流星壁纸工艺重做（3 大小/5 亮度/5 闪烁频率档 + 蓝紫色偏 + 460 颗 + 亮度走 q.dot alpha）+银河 bloom/granulation 减半。**教训：out/_harness.bundle.js 会过期，目检前必须重建并用唯一文件名防浏览器缓存（_h2/_h3 方式）**
- **2026-11-22**：LICENSE 改 **GPL-3.0**（README/NOTICE 同步；商店许可条款字段待用户同步）；rift 闪电重做（雷暴三层 stroke 工艺，三样式：贯穿雷击/叉状爆发/沿缝电弧）；sandstorm noBolt+删拖尾圆环；heaven 纯黑天空+银河减淡+循环卡顿修复（far() 裸 t 回绕跳 9px）。已推 GitHub。
- **发行准备 1.0.2.1 已就绪**（journal `collab/journal/2026-11-21-1529-ZCode-release-1.0.2.1.md`）：雏菊阴影改花瓣形、下拉分组对调（本地在上）、**3D 雏菊水塘打包预装**（exe 资源 → 启动写 WallpaperDir + 注册，`daisyPondGone` 尊重用户删除）、version 1.0.2.1。产物：exe 591 KB / Setup 921 KB / `4A5AB34E.62945D70D0F14_1.0.2.1_x64.msix` 0.8 MB。
- 本日早前：uv→像素 X 映射修复（鱼食漂移真根因，画布层 X 曾被压到 56%）+ 点击十字诊断标记；锦鲤/鱼食/雏菊晃动/改名全落地（见 journal 13:22~15:13 各条）。
- **商店/GitHub 待执行**：用户在 Partner Center 上传 1.0.2.1 msix + 填 What's new；GitHub push（origin 已配 ssh）。

## 3. 未完成 / 未验证

- [ ] **WACK 未重跑**（1.0.2.1 商店提交前建议补跑一次）
- [ ] 真机验收：预装壁纸出现在"本地壁纸"组、删除后重启不复活、花瓣阴影、下拉分组顺序
- [ ] 真机验收（遗留）：预览即时显示、窗口 1600×1000、锦鲤/鱼食/逃跑手感、改名弹窗、桌面点击双环、调参滑杆
- [ ] 旧验收项与 8 语言缺 46 键待办见 `collab\STATE.md`
- [ ] 内置 320×180 版 daisypond 角色待裁决（保留 or 下线留 DRAFT）

---

## 4. 硬规矩（违反这几条最容易出事）

1. **`src/**` 引擎文件一行不改**，所有包装在 `palette-wallpaper\src\**` 里做。
2. **`shell/Lang.Generated.cs` 是构建生成物**，只改 `src/i18n.json` 再跑 build，绝不手改。
3. `.gitignore` 是**白名单式**（首行 `*` 全忽略）：新建任何要入库的文件，必须在末尾补 `!路径` 放行。
4. `out\` 下的产物**不入库**；`collab\locks\` 也不入库。
5. 用户壁纸走 `srcdoc iframe`，别改回 `wp.local`（历史坑）。
6. 改完必须跑 `node palette-wallpaper/build.mjs` 并**通过**，否则 exe 里还是旧内容。

## 5. 收工三件事（不做，下一个人就会瞎猜）

1. **写 journal**：`collab\journal\YYYY-MM-DD-HHMM-Agent-标题.md`（模板 `_TEMPLATE.md`）。四段：改动 / 原因 / 影响 / 验证，**验证必须写实测数字**。
2. **更新 `collab\STATE.md`**：HEAD、验证状态、最近 3 条、下一步。三行以内，只写"现在"。
3. **更新本文件第 2、3 节**：现在在哪、未完成。

多人/多 AI 并行时才用锁：`collab\bin\claim.ps1` 声明 → 改 → `commit.ps1` 提交 → 释放。

---

## 6. 环境坑（这台机器专属）

- **从 `out\` 根启动 exe 必崩**：`0xE0434352` + `FileNotFoundException 在 WebView2Ready()`（缺 `WebView2Loader.dll`）。改用 `out\msix\`。
- **单实例**：用户已装的 `Programs\PixelPalette\PixelPalette.exe` 在跑时，新启动会握手后静默退出（`HasExited=True, ExitCode=0`），看着像"启动即崩"。测新版先 kill `PixelPalette` + `msedgewebview2`。
- 设置窗**没有快捷键**，只能托盘双击 / 托盘菜单（暂停热键默认 `Ctrl+Alt+P`）。
- 含中文的 `.ps1` 必须存 **UTF-8 with BOM**，否则路径按 ANSI 读成乱码。
- `git` 显示中文名要 `-c core.quotepath=false`；`ConvertFrom-Json` 会放过跨行字符串（i18n.json 用 `node -e "JSON.parse(...)"` 校验）。
- `D:\aaa\...` 写操作在某些环境下要提权；只读不受限。

## 7. 已经拍过的板（别再提）

- **不做**「先收费再宣传」，**不做**「不停堆壁纸数量」。路线：先免费开源做分发，AI 制作规范是唯一壁垒，B2B/OEM 是长期方向。
- 许可证 GPL-3.0（不是 MIT）。
- 3D 壁纸**不藏**：缓存已治到 11.7 MB，3D 正常跑。
- 商店短语不提"2D"，不与「完全离线」重复表述"不联网"。
