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
| 版本 | `palette-wallpaper\version.mjs` = `1.0.0.0`（**唯一版本源**，只有发行才改） |
| 构建 | `node palette-wallpaper/build.mjs` → 产物在 `out\`（exe/setup/msix/app.zip） |
| 启动测试 | **`out\msix\PixelPalette.exe`**（`out\` 根缺 dll，从那里启动必崩） |
| 数据目录 | `%LOCALAPPDATA%\PixelPalette`（`settings.json` / `wallpapers` / `pets` / `webview` / `log.txt`） |

---

## 2. 现在在哪（2026-11-21 13:47）

- git HEAD `bd5ef68` 之后新增一轮（journal 见 `collab/journal/2026-11-21-1347-ZCode-settings-local-wall-merge.md` 同目录下 1347 条），verify 全 ok、build 通过（exe 578 KB / Setup 910 KB / MSIX 0.8 MB）。
- 本轮三项：
  1. **预览即时显示修复（真根因）**：`Program.cs` 三处首推设置页的配置走 `Store.Json` 不带 `wallHtmls`（只有 Apply 才 `Augment`），ext 预览永远落在占位卡；已全部改 `Augment(Store.Json(Cfg))`。**教训：load() 整体替换页面 cfg，任何 Push 都必须带 Augment**。
  2. **设置窗默认 1600×1000**（用户嫌 1152×648 不够大，16:9 只执行了一轮就被推翻）。
  3. **雏菊水塘 1080P 加锦鲤**：水面叠透明 2D canvas 画红锦鲤（白斑变种、大小不一、双正弦+随机脉冲游走、鼠标靠近 ×10 burst 逃跑并起涟漪），着色器未动；`fish` 参数 0–8 默认 5；skill/examples 已同步。**已装用户要重新加载壁纸文件才有鱼**。
- 上一轮：本地壁纸并入"当前壁纸"下拉（optgroup 两组 + 加载/删除/恢复）；journal `2026-11-21-1322-ZCode-settings-local-wall-merge.md`。
- 更早：`2b34486` 外部壁纸自带调参；`c49f731` wallClick 双环；雏菊水塘 1080P 版用户已验收。

## 3. 未完成 / 未验证

- [ ] **真机验收（本轮）**：打开设置 → 选本地壁纸预览应立即出画面（不用按保存）；窗口默认 1600×1000；雏菊水塘有 5 条锦鲤游动、鼠标靠近会跑、设置页"锦鲤数量"滑杆可用
- [ ] 真机验收（遗留）：桌面点击双环、「此壁纸的参数」滑杆、本地壁纸删除/恢复按钮
- [ ] 新 exe 未重跑 WACK（下次商店更新前补跑）
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
