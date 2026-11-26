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
| 商店 | Store ID `9NZV5LCNMW9F`，Identity `4A5AB34E.62945D70D0F14`；1.0.0.0 已上架，**1.0.3.0 待用户上传**（同名升级，1.0.2.8 被以「版本号非零」拒收） |
| 版本 | `palette-wallpaper\version.mjs` = **`1.0.3.0`**（**唯一版本源**，只有发行才改；**第四段必须为 0**，生成号当计数器 → 1.0.4.0、1.0.5.0…） |
| 构建 | `node palette-wallpaper/build.mjs` → 产物在 `out\`（exe/setup/msix/app.zip） |
| 启动测试 | **`out\msix\PixelPalette.exe`**（`out\` 根缺 dll，从那里启动必崩） |
| 数据目录 | `%LOCALAPPDATA%\PixelPalette`（`settings.json` / `wallpapers` / `pets` / `webview` / `log.txt`） |

---

## 2. 现在在哪（2026-11-26 22:50 · 交接版）

- **HEAD `6abea63`，已推 GitHub，工作区干净。版本 1.0.3.0，商店包已重建（794 KB），待用户上传**——1.0.2.8 被 Partner Center 拒收，报错原文「应用程序不得拥有版本，其版本号在应用清单中指定的非零」，**实指第四个版本段（修订号 revision）必须为 0**：1.0.2.1（rev=1）、1.0.2.8（rev=8）都违规，只有 1.0.0.0（rev=0）合规。已改 `version.mjs` 为 1.0.3.0，并在 `msix.mjs` 加了前置校验（非 x.y.z.0 直接抛错不产包）。`runFullTrust` 那条是警告不是错误，1.0.0.0 已带它在架，无需处理。
- 本轮（11-26，豆包）：
  1. `6abea63` 版本 1.0.2.8→1.0.3.0 + msix.mjs 修订号校验（journal: `collab/journal/2026-11-26-2243-豆包-msix-revision-zero.md`）
- 上一轮（11-21~23，ZCode）按时间倒序：
  1. `6985991` 设置窗标题栏挂 app 图标（原来显示 WinForms 默认的彩色格子，用户截图反馈）
  2. `8c9010d` **painter 字符串色真根因**：引擎 painter 只收 hex() 打包数值色，字符串渲染成黑——meteors.js 流星从上线起就没渲染出来过（黑烟/看不见）；修=LIST 后 m.C.map(hex)。另修 heaven origin 170 vs 流星表 180 的 10px 裁切（drawMeteors 加 dy），星星 130→300
  3. `6b43d00`/`f5678f2` heaven 星空/流星逐字复刻 shooting-stars（用户点名"直接抄"），含 6 色 ramp 修 C[4] undefined 黑烟
  4. `1c46813` 共享流星系统 src/fx/meteors.js 接入 heaven/rift/otherworld-rift
  5. `0e9d31f` **GPL-3.0**（LICENSE/README/NOTICE 同步；商店许可条款字段待用户同步）；rift 雷暴闪电三样式；sandstorm noBolt/noWind/删圆环；heaven 纯黑天空+银河减淡+循环卡顿修复（far() 裸 t 回绕跳 9px）
  6. `3baeafa` 下线 2D 雏菊水塘+峡谷晨雾（场景 25→23，源留 DRAFT，旧配置自动回退）；参数面板挪进场景卡片
  7. `0a9bd1b` 发行 1.0.2.1：雏菊花瓣阴影、下拉分组对调（本地在上）、**3D 雏菊水塘预装**（exe 资源→启动写 WallpaperDir+注册，daisyPondGone 尊重删除）
  8. 更早：锦鲤层/鱼食抢食/雏菊晃动/壁纸改名；uv→像素 X 映射修复（鱼食"漂移"根因=v*H 应为 v*W）
- **设置页 UI 现状**：本地壁纸并入"当前壁纸"下拉（本地在上、系统在下）+ 加载/删除/改名/恢复三按钮；「此壁纸的参数」在场景卡片内背景上方；窗口 1600×1000。

## 3. 未完成 / 未验证

- [ ] 用户：Partner Center 上传 **`out\4A5AB34E.62945D70D0F14_1.0.3.0_x64.msix`** + What's new（文案在 `D:\AAAAA\ShiPin\1\about-prompt\商店更新说明-1.0.2.8.md`，**文内版本号要改成 1.0.3.0**）+ 许可条款字段 GPL-3.0；旧的 1.0.2.8 提交删掉
- [ ] GitHub 侧还没跟上：远端最新 tag 是 `v1.0.2.8`，**没有 v1.0.3.0 tag、没有对应 Release**；CHANGELOG 只写到 1.0.0.0；README 的「21 个程序化场景」已过时（现为 23）。`out/**` 被 .gitignore 排除，安装器与 msix 必须走 Release 附件手工上传
- [ ] 1.0.3.0 未重跑 WACK（只改了 Version 属性，负载未变；商店若要求可补）
- [ ] 真机验收：设置窗标题栏图标（本轮修复）、预装壁纸出现在"本地壁纸"组、删除不复活、流星/星星观感、锦鲤/鱼食/逃跑手感、改名弹窗、预览即时显示
- [ ] 8 语言缺键待办与旧验收项见 `collab\STATE.md`
- [ ] 待裁决：开源协议已改 GPL-3.0，商店 1.0.0.0 已上架版本不受影响；后续发行记得同步许可条款

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
