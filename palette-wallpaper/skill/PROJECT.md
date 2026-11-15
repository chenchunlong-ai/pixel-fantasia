# Skill: 像素幻境 项目总监指南 (Pixel Fantasia Project Guide)

> 把这个文件喂给任何 AI，它就立刻成为本项目的"项目总监"：了解项目是什么、代码在哪、
> 怎么构建、怎么改版、怎么制作 2D/3D 壁纸和宠物、怎么上架微软商店、哪里有坑。
> 配套文件：`skill/SKILL.md`（壁纸/宠物的制作范式）——本文件管项目，那个管内容生产。

---

## 一、项目是什么

**像素幻境 / Pixel Fantasia**（内部代号 PixelPalette）——Windows 动态壁纸软件，双身份：

1. **程序化像素壁纸应用**：21 个内置场景 + 27 套调色板一键换色 + 11 只内置桌面宠物；
2. **开放的动态壁纸容器**：用户/AI 可加载单文件 HTML 壁纸（2D/3D/WebGL/视频）和透明宠物文件。

**核心卖点**：安装包 <1MB、完全离线、零网络、程序化生成、桌宠与壁纸一体。竞品对标：
Wallpaper Engine（百 MB 级、依赖在线内容库），我们走"超小体积 + 离线 + 开放容器"差异化路线。

**现状（2026-11-15）**：v1.0.0.0 已提交微软商店认证（WACK 25/25 PASS），开源仓库
https://github.com/chenchunlong-ai/pixel-fantasia ，隐私政策
https://chenchunlong-ai.github.io/pixel-fantasia/privacy.html

---

## 二、代码地图（仓库 `palette-wallpaper/`）

```
palette-wallpaper/
├── build.mjs              # 一键构建：bundle 页面 → csc 编译外壳 → 安装器 → MSIX
├── verify.mjs             # Node 侧验证：场景能画、换色有效
├── shot.mjs               # 渲染场景帧 → PNG（注意：其 CRC 是错的，python 重算后 PIL 才能读）
├── version.mjs            # 唯一版本号源（MSIX 清单 + 设置页关于菜单共用）
├── msix.mjs               # MSIX 打包（身份/版本/图标/权限）
├── icon-assets.mjs        # app-icon.jpg → 全套 ico + 商店图
├── app.manifest           # DPI 感知
├── shell/                 # C# 外壳（csc 直译 .NET Framework 4，无 NuGet 无 SDK）
│   ├── Entry.cs           # 入口：单实例、WebView2 缺失兜底（禁 Process.Start！WACK 会 FAIL）
│   ├── Program.cs         # 主程序：App 类、消息路由（OnWallpaperMessage/OnSettingsMessage 成对处理！）、
│   │                      #   Augment()（读用户壁纸/宠物文件注入 CSP）、SaveSkill()、Resource() 解压
│   ├── Wallpaper.cs       # 壁纸窗口：WorkerW 挂载、Push（ExecuteScriptAsync）、竞态补推
│   ├── SettingsWindow.cs  # 设置窗口 WebView2
│   ├── Config.cs          # Settings 模型（petCfg 按壁纸分组）、Store 存取
│   ├── Native.cs          # Win32（WorkerW/图标层等）
│   ├── WinRt.cs           # WinRT（锁屏、StartupTask）——winmd 管线在 build.mjs
│   ├── Installer.cs       # 独立安装器（含 Process.Start，不在 MSIX payload，WACK 不扫）
│   └── Lang.Generated.cs  # 由 i18n.json 自动生成（build.mjs），勿手改
├── src/                   # 网页层（构建时内嵌进 exe 的 html.gz）
│   ├── runtime.html/js    # 内置场景播放页（320×180 canvas 放大）
│   ├── wallwrap.html/js   # 用户壁纸包装页（HTML 壁纸走 srcdoc iframe！wp.local 不可靠）
│   ├── settings.html/js   # 设置页（顶栏菜单：语言/设置/关于；预览实时渲染+宠物摆放）
│   ├── pets.js            # 宠物层：initPets（槽位渲染）+ createBuiltinDrawer（内置 critter 绘制）
│   ├── params.js          # 配置模型 normalize()、petPose()
│   ├── effects.js         # 场景注册表（21 个，含 hiddenFx 隐藏机制）
│   ├── palettes.js        # 27 调色板
│   ├── player.js          # 渲染器：合成 + 亮度索引换色 LUT（77R+150G+29B）
│   ├── i18n.json          # 9 语言全部文案（build 自动生成 Lang.Generated.cs）
│   └── fx/                # 场景实现：weather/（12 天气）+ 自制（rift/sandstorm/tornado 系/瀑布谷等）
├── skill/SKILL.md         # 壁纸/宠物制作范式（对外发布，关于页可下载）
├── skill/PROJECT.md       # 本文件
├── skill/examples/        # 范例：aurora-cabin.html（2D）、aurora-valley-3d.html（3D WebGL）、snow-fox.html（宠物）
├── store-site/privacy.html# 隐私政策页（GitHub Pages 托管）
└── out/                   # 构建产物（exe/Setup/msix/store 截图/9 国文案）
```

**引擎上游**：`../src/`（仓库根的 src/）是 patch-gg/pixelfx（MIT，5.8k star）的原装引擎，
palette-wallpaper 的 src/ 通过相对路径 `../../src/` 引用引擎核心，一行没改引擎原文件。

---

## 三、构建与部署（全部命令）

```bash
node palette-wallpaper/build.mjs    # 全量：bundle + csc + 安装器 + MSIX（自动跑 icon-assets/msix）
node palette-wallpaper/verify.mjs   # 场景验证
```

产物：`out/app/PixelPalette.exe`（主程序 ~430KB）、`out/PixelPalette-Setup.exe`（~730KB）、
`out/4A5AB34E.62945D70D0F14_1.0.0.0_x64.msix`（商店包，命名=Identity_版本_架构，商店硬要求）。

**部署到本机测试**（exe 被占用要先杀进程）：
```powershell
Stop-Process -Name PixelPalette -Force -ErrorAction SilentlyContinue; Start-Sleep 1
Copy-Item '...\out\app\PixelPalette.exe' "$env:LOCALAPPDATA\Programs\PixelPalette\PixelPalette.exe" -Force
Start-Process "$env:LOCALAPPDATA\Programs\PixelPalette\PixelPalette.exe"
```

**改版本号**：只改 `version.mjs`（MSIX 清单、设置页关于菜单自动同步）。商店更新必须递增（如 1.0.1.0）。

**测试设置页**：浏览器只能用 `out/settings.html`（打包版）；`src/settings.html` 直载模块不执行（原因未明）。
浏览器验证需静态服务器（`npx http-server -p <端口> -c-1` 从仓库根起，禁缓存）。

---

## 四、运行时架构（理解了这个才能改对地方）

```
[托盘/设置窗口 WinForms] --WebMessageReceived--> [C# App]
C# 持有唯一 Settings（%LOCALAPPDATA%\PixelPalette\settings.json）
C# --ExecuteScriptAsync("window.pixelFX.apply(json)")--> [壁纸 WebView2]
壁纸页 = runtime.html（内置场景）或 wallwrap.html（用户壁纸）
  ├── 内置场景：player.js 逐像素渲染 320×180 → CSS 放大
  ├── 用户 HTML 壁纸：wallwrap 把 Augment 注入的 wallHtmls[id] 用 srcdoc iframe 挂载
  └── 宠物层 pets.js：.petSlot（20vw，translate(-50%,-50%) 居中）叠在壁纸上
设置页设置 = 同一套 UI 的镜像（独立 WebView2），宠物摆放用 petPose 消息实时推给桌面
```

关键消息流：
- `petPose`（设置页拖拽）→ **OnSettingsMessage**（不是 OnWallpaperMessage！两个处理器分支要成对）→ 存盘 + Wallpaper.Push；
- `state`/`ready`/`wallFrame`/`dbg` ← 壁纸页上报；
- `saveSkill` → C# 把内嵌 SKILL.md 写到 我的文档\像素幻境\。

---

## 五、如何制作添加 2D 动态壁纸

**范式文件：`skill/SKILL.md`**（先读它！）。要点：
1. 单文件 HTML、零网络、禁弹窗；首行注释 `<!-- pixel-wallpaper {"format":1,"type":"wallpaper"} -->`；
2. 无缝循环（所有相位是 t/LOOP 的整数倍频率）或标注 `"loop":0` 持续演化型；
3. 可选钩子 `window.wallSpeed(v)`（软件速度滑杆调用）；
4. 生成后：设置页 → 我的壁纸 → 加载（file input→base64→C# 落盘 `%LOCALAPPDATA%\PixelPalette\wallpapers`）。

**内置场景开发**（改 `src/fx/weather/*.js` 或新建场景注册进 effects.js）：
- 场景 = 纯时间函数 `draw(p, t, o)`，随机数用 `rand(seed, i, j, n)` 保证确定性与闭环；
- 注意 `meta.size`（瀑布谷 320×200 需 canvas 自适应）、`o.palette` 是引擎内部色板（用户换装走 `look` 字段，混入会崩）；
- 改完跑 `verify.mjs` + `shot.mjs` 目检（PNG CRC 要 python 重算才能用 PIL 读）。

**3D 壁纸**：手写 WebGL（范例 `skill/examples/aurora-valley-3d.html`，8KB 零依赖）；
红线：DPR≤1.5、30fps 闸门、document.hidden 暂停、禁 pointer 事件（壁纸窗口收不到鼠标）、
程序化贴图或 base64。SKILL.md 有"3D/着色器场景专属规则"章节。

## 六、如何制作添加宠物

- **内置 critter**：`src/fx/critters/*.js` 引擎现成 11 只（butterfly/ghost/bat/frog/skull…），
  pets.js 的 createBuiltinDrawer 画进槽内 canvas（3x 像素化），params.js 的 BUILTIN_PETS 列表控制可选集；
- **文件宠物**：单文件 HTML 透明背景（范式 type:"pet"），尺寸占槽较小边 ~55%；
  宠物直挂主页面代码层（**iframe 内 canvas 不上屏是 WebView2 死穴**）；
- **摆放**：设置页预览小窗拖拽（桌面拖拽因图标层拦截已废弃），pose={x,y,scale,rot,flip,on}
  按**壁纸 id 分组**记忆在 settings.json 的 petCfg；位置语义=中心点百分比（跨分辨率一致）。

## 七、微软商店上架（已完成一遍，照抄即可）

1. **身份**：Partner Center 分配 → msix.mjs 顶部 IDENTITY_NAME="4A5AB34E.62945D70D0F14"、
   PUBLISHER="CN=190194D9-6D06-4DDF-B9EE-AFCB01412655"、DISPLAY_NAME="像素幻境"（须与预留名一字不差）、
   PUBLISHER_DISPLAY="迷游兔工作室"、Store ID 9NZV5LCNMW9F。
2. **版本**：version.mjs，四段式、末段 0、每次更新递增。
3. **能力**：只声明 runFullTrust（受限能力，提交时填理由：WorkerW 挂载/WebView2 宿主/锁屏）。
   picturesLibrary 等未用的一律不声明（多声明是驳回常见原因）。
4. **WACK**：管理员 PowerShell，参数是 **-appxpackagepath**（不是 -appx！）：
   `appcert.exe test -appxpackagepath '<msix路径>' -reportoutputpath '<xml文件路径>'`
   需纯 ASCII 路径（D:\aaa\wack\）。exe 内禁一切进程启动 API（Process.Start 和
   ShellExecuteW 都 FAIL）——开链接一律用"复制到剪贴板"。
5. **材料**：9 国文案 `out/store/listing-9languages.txt`；截图 `out/store/shot-*.png`
   （shot.mjs 渲染 + 最近邻放大 6 倍）；隐私政策 URL（GitHub Pages，仓库 privacy.html）。
6. **设备家族**：只勾 Windows 10/11 Desktop；WoA 提示可忽略（我们是 x64 包，模拟层兼容）。
7. **审核备注**：粘贴"壁纸挂 WorkerW 需要 runFullTrust，完全离线无网络"说明。

## 八、坑库（血泪教训，改代码前先读）

1. **runtime.html 的 CSS 裸露在 style 标签外曾致宠物永不移动**——改 HTML 必查标签闭合；
2. **wp.local 虚拟域名 iframe 间歇性不渲染**——HTML 壁纸一律走 srcdoc（无 sandbox），
   视频类才用 wp.local（相对路径 video src）+ `?v=Date.now()` 缓存击穿；
3. **iframe 内 postMessage 到不了宿主**——壁纸文件自身无上报通道，排障靠判别式截图
   （DPI 感知 + MinimizeAll + CopyFromScreen）；
4. **ExecuteScriptAsync 推配置与模块加载有竞态**——ready 后补推 + 1.2s 幂等补推兜底；
5. **shot.mjs PNG CRC 错误**——python 重算所有 chunk CRC 后 PIL 才能读；
6. **IAB 验证**：src/settings.html 模块不执行，用 out/ 打包版；后台标签 rAF 节流到 2fps 是假象；
7. **rift 类场景缩短端点**后，clamp 会在端点外画针尖线——raw 越界直接 continue；
8. **Package/DisplayName 必须与预留名一致**，否则商店包验证失败；
9. **构建产物同步**：测试/上传前确认用最新包（有过 wack 副本滞后半天的教训）；
10. **WinForms OpenFileDialog 在 WebView2 宿主里不可见且阻塞**——文件选择用网页 file input。

## 九、路线图（已拍板未开工）

- **打赏**：路线 A = Microsoft Store 消耗型附加组件（Partner Center 建两档 ¥6/¥18），
  `Windows.Services.Store` API 弹商店购买窗，只致谢不解锁任何功能；作为 1.0.1.0 更新，
  等 1.0.0.0 过审后开工。**PaymentMediator/Payment Request API 是废弃方案，禁用。**
- **鼠标交互**（雪随气流）：混合架构已定——循环保留 + 交互粒子层（借粒子进物理态、衰减归位）；
  外壳 GetCursorPos 轮询 → 现有 Push 通道推给页面。等打赏后做。
- **Gitee 镜像**：建好后填入 settings.js REPO_URLS.gitee（空则入口自动隐藏）。
- **开源准备**：skill/SKILL.md 已是发布版（关于页可下载），仓库 README 待补。

## 十、验证清单（每次改版后过一遍）

- [ ] build.mjs 无报错，产物时间戳是新的
- [ ] out/app 里跑 exe：桌面壁纸动、设置页开、宠物拖拽跟手、加载/隐藏/换色可用
- [ ] verify.mjs 通过
- [ ] 设置页 IAB 验证（out 版）：下拉、预览、关于菜单版本号正确
- [ ] 商店更新：版本递增、WACK 重跑、listing 文案补"新增功能"
