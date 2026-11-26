# MSIX 版本修订号必须为 0：1.0.2.8 → 1.0.3.0
- **Agent**: 豆包  **Task**: 商店提交 1.0.3.0  **时间**: 2026-11-26 22:43

## 改动
- `palette-wallpaper/version.mjs`：`1.0.2.8` → `1.0.3.0`，并注明「生成号当计数器、第四段恒为 0」的约定
- `palette-wallpaper/msix.mjs`：`buildMsix()` 入口新增版本校验，版本不是 `x.y.z.0` 直接抛错、不产包

## 原因
用户在 Partner Center 提交 `4A5AB34E.62945D70D0F14_1.0.2.8_x64.msix` 被拒：「包接受验证错误：应用程序不得拥有版本，其版本号在应用清单中指定的非零。指定了 1.0.2.8」。
逐行 diff 过 1.0.0.0 / 1.0.2.8 两份清单：Identity Name、Publisher、Application/uap/desktop 结构、runFullTrust 全部一致，**唯一差异就是 Identity 的 Version 属性**。故判定为版本号格式问题：商店要求第四段（修订号 revision）为 0，报文里的「非零」指的是修订号而不是整个版本号。1.0.2.1（revision=1）、1.0.2.8（revision=8）都违规；1.0.0.0 合规所以能上架。

## 影响
- 需重跑 `node palette-wallpaper/build.mjs`；产物 `out/4A5AB34E.62945D70D0F14_1.0.3.0_x64.msix`（794 KB）
- 设置页「关于」版本号随 VERSION 自动变 1.0.3.0（build.mjs 里 `__VER_TOKEN__` 替换），不会出现商店号与界面号不一致
- 后续发行节奏变为 1.0.3.0 → 1.0.4.0 → 1.0.5.0（生成号递增，修订号恒 0）
- CHANGELOG / README / git tag / GitHub Release **本次未动**，仍指向 1.0.2.8

**是否动了这些高危面**（有就打勾并写一句改了什么，没有就写"未动"）：
- [ ] 依赖（`package.json` / `package-lock.json` / 外部 DLL）— 未动
- [x] 构建与打包脚本（`*.mjs` / `msix.mjs` / `AppxManifest.xml`）— msix.mjs 加版本前置校验，清单模板未改
- [x] 版本号（`version.mjs`）— 1.0.2.8 → 1.0.3.0
- [ ] 用户数据格式（`settings.json` 字段、`wallpapers` / `pets` 目录结构）— 未动
- [ ] WebView2 环境参数（`Program.cs` 里的 flags / 缓存目录）— 未动

## 验证
- `node palette-wallpaper/build.mjs` 全流程通过，末尾输出 `· MSIX 0.8 MB → out\4A5AB34E.62945D70D0F14_1.0.3.0_x64.msix`
- 解包核验清单：`<Identity ... Version="1.0.3.0" .../>`，Name / Publisher / ProcessorArchitecture 均未变；体积 794 KB（与 1.0.2.8 一致，证明只有版本号一处变化）
- 未重跑 WACK（包内仅版本号一处变化、二进制负载未改；若商店侧要求可补跑）
