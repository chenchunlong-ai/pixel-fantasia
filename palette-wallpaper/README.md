# 像素幻境 · Pixel Fantasia（Windows）

调色板换装壁纸：同一个场景，点一下按钮换一套调色板，**整屏颜色瞬间整套替换**——
雪原变寒冰、瀑布变熔岩、草原变剧毒，画面不动，只有颜色换。

## 打包产物

| 文件 | 用途 |
| --- | --- |
| `out/PixelPalette-Setup.exe`（约 515 KB） | 自带安装器：双击安装、开机自启、托盘 |
| `out/PixelFantasia.msix`（约 0.4 MB） | Microsoft Store 提交格式。**只声明 `runFullTrust`**（壁纸挂 WorkerW 必需）；picturesLibrary/backgroundMediaPlayback 未使用就不声明（多声明是审核驳回的常见原因）。自启用 MSIX StartupTask 扩展。提交前把 AppxManifest 的 Identity Name/Publisher 换成 Partner Center 分配的值；本地 .msix 未签名，商店提交时由商店签名 |

## 开源合规（可上架的依据）

- 引擎 [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx)（作者 Patch，5.8k star）是 **MIT 协议**，官方明确 "code and effects, use them in anything, commercial included"——商用上架没有问题；
- MIT 的义务是**分发时随附版权与许可声明**：安装包和 MSIX 内已带 `LICENSE`、`NOTICE.md`、`OPEN-SOURCE-NOTICES.txt`（build.mjs 自动打包）；
- 其中两个特效改编自 Hugo Duprez 的 MIT 素材（NOTICE.md 已注明）；Patch Pixel 字体**本应用未使用**，其"不随 MIT 分发"的例外不涉及。

## 与第一个壁纸软件（desktop/）的关系

- 引擎、12 个核心天气场景全部**原装复用** `src/`，一行没改；
- 我们自己做的 6 个场景也放进来了：黑洞·吸积盘、时空裂缝、星夜草原、
  创生之柱、瀑布谷、宝塔湖（后三个从 backup/removed-fx-2026-11-06 复原，导入路径已适配）；
- 外壳、安装器沿用 desktop/ 的小体积方案（WebView2 + .NET Framework 编译，
  无 SDK、无 NuGet、无需管理员），**安装包约 488 KB**。

## 功能

| 功能 | 说明 |
| --- | --- |
| 一键换装 | 「一键换装」按钮按顺序切下一套调色板，瞬间换色 |
| 调色板选择器 | 原色 + 引擎 27 套色板（火焰/寒冰/奥术/黄金/霓虹/矩阵……），色条预览 |
| 场景 | 12 个核心天气（沙尘暴/时空裂缝为本项目重制版）+ 3 个自制场景（黑洞×2、星夜草原、瀑布谷）+ 3 个龙卷风 + 数据流，共 21 个 |
| 沙尘暴（重制） | 龙卷风框架去掉漏斗：纯黑天空 + 顶部风暴云 deck + 沙粒横扫/跳跃/尘暴团翻滚 + 偶发闪电，蛇保留 |
| 时空裂缝（重制） | 撕口改为锯齿状纸张撕裂（每约 3px 一个随机咬口），星云在撕口内翻涌，边缘辉光 |
| 龙卷风三景 | `palette/fire-tornado` 火焰龙卷风（纯黑天空 + 火星群环绕漏斗 + 流星坠地 + 闪电）、`palette/blizzard-vortex` 暴风雪漩涡（纯黑天空 + 冰晶群环绕 + 冰雨 + 闪电）、`palette/tornado` 龙卷风（纯黑天空 + 树叶群环绕旋转 + 闪电）。基于共享核心 `_tornado.js`（项目内拷贝，云 deck 比引擎默认抬高），不改引擎原文件 |
| 小生物 | 9 个场景叠加了引擎现成的动物：雪/云→鸟，雨/萤火虫→青蛙，雷暴→蝙蝠，沙尘暴→蛇，雾→鬼火，瀑布谷/宝塔湖→蝴蝶（`src/scenes/_lively.js` 合成，不改引擎原文件，动物也跟着调色板一起换色） |
| 背景 | 只保留引擎三选一：星空 / 纯黑 / 石地 |
| 镜像 | 整个画面左右翻转（CSS scaleX，零渲染开销） |
| 换装原理 | 每像素按感知亮度（77R+150G+29B）重新索引到所选色板——像素画的亮度结构原样保留 |

另有：自动轮播、速度/密度参数、暂停快捷键、开机自启、锁屏、9 国语言，与第一代一致。

## 构建 / 开发

```
node palette-wallpaper/build.mjs    # 产出 out/PixelPalette.exe 和 PixelPalette-Setup.exe
node palette-wallpaper/verify.mjs   # Node 侧验证：18 个场景都能画、换装确实换色、三种背景可用
```

浏览器预览（引擎按相对路径直接 import，无需打包）：
直接用任意静态服务器指到仓库根目录，打开
`palette-wallpaper/src/runtime.html?fx=weather/snow&palette=ice&bg=black&mirror=1`。

## 文件

- `src/effects.js` — 场景目录（12 天气 + 6 自制）
- `src/palettes.js` — 调色板衣柜（none + 引擎 PAL 全部 27 套）
- `src/player.js` — 渲染器：合成 + 亮度索引换装（LUT，每帧一遍）
- `src/params.js` — 配置模型（palette / bg / mirror 字段）
- `src/fx/*.js` — 从 backup 复原的三个自制场景（导入路径已改）
- `shell/*.cs` — 原生外壳（沿用 desktop/，改名 PixelPalette，新增 palette/bg/mirror 配置）
- `build.mjs` — 打包脚本（复用 desktop/ 的 WebView2 SDK 与 winmd 缓存）
