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

## 2. 现在在哪（2026-11-18 03:15）

- git HEAD `3e6adf2`，工作区干净，**文件锁全部空闲**，没有在飞改动。
- 已构建、已真机验证的最新产物：`out\msix`（缓存治理版）。
- 最后三次改动（都在 `palette-wallpaper`，都有 journal）：
  1. `3e6adf2` **WebView2 缓存治理**：`Program.cs` 注入 `--disk-cache-size=8388608 --gpu-disk-cache-size-kb=8192 --disable-component-update --disable-features=...`；设置页加「清理缓存」；真机 3D 正常，**缓存目录 72.5 MB → 11.7 MB**
  2. `b661820` 顶部副标题改商店 A 版文案（9 语言，`appSub`）
  3. `fd48091` 关于页「复制制作提示词」按钮
- 老坑已查清：旧缓存 72.5 MB 里约 60 MB 是 WebView2 自己下的组件（Widevine 21.9 / component_crx_cache 21.4 / Subresource Filter 12.3），**跟 3D 无关**；3D 真实占用约 6 MB。

## 3. 未完成 / 未验证

- [ ] **「清理缓存」按钮的真实点击没验过**（设置窗只能托盘双击开）。期望：显示「当前缓存 X MB」→ 点后「已清理，重启应用后完全释放」→ 重启后 `webview` 目录清空。
- [ ] `GrShaderCache` 稳定在 4.6 MB，`--gpu-disk-cache-size-kb=8192` 是否真约束它未单独验证；也未做小时级长时间观察。
- [ ] 顶部副标题 66 字在 `.sub` 11px 下**折成 2 行**，是否接受待人类裁决。
- [ ] 商店 Short description 是否把「不到 1MB」改成「安装包不到 1MB」待人类裁决。

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
