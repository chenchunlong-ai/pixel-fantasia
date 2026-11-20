# Skill: 像素幻境动态壁纸制作范式 (Pixel Fantasia Wallpaper Skill)

> 把这个文件喂给任何 AI（或自己照着做），产出的**单个 HTML 文件**就可以直接加载进
> 「像素幻境 / Pixel Fantasia」动态壁纸软件，成为一张可启用、可摆放宠物、随壁纸记忆的动态壁纸。
> 项目本身的架构/构建/上架/坑库见 `skill/PROJECT.md`（项目总监指南）。

---

## 你的任务（给 AI 的指令）

用户会描述一张想象中的动态壁纸（或宠物）。**先问清三件事**（用户没说就先提问，不要猜）：

1. **横屏还是竖屏？目标分辨率是多少？**（1080P / 4K / 不确定就做自适应）
2. **像素风还是高清风？**（像素风 = 小画布 + `image-rendering: pixelated` 放大，如 320×180；高清风 = 按 1:1 分辨率画）
3. **无缝循环时长**希望多少秒？（建议 8~30 秒）

然后按下面范式输出**一个自包含的 `.html` 文件**，交给用户拖进软件即可。

---

## 范式（必须遵守的格式规则）

### 通用规则（壁纸和宠物都要遵守）

1. **单文件**：所有 CSS/JS/素材都在这一个 html 里。图片/音频用 base64 data URI 内嵌。
2. **零网络**：不许出现任何 `http://` / `https://` 外部请求、CDN、字体在线加载。软件容器会直接拦截，请求一律 403。
3. **零窗口行为**：不许 `window.open`、弹窗、alert 循环、试图导航或读写本地文件。
   **安全机制**：软件加载你的文件时会自动注入一层 CSP（内容安全策略）——`default-src 'none'`，联网请求一律被浏览器内核拦截。这是双保险之一，容器还有请求拦截层。所以**写了外部请求的文件也能跑，但资源全部加载失败**——照规范自包含才是正路。
4. **无缝循环**：所有动画写成时间 t 的纯函数，且所有相位都是 `t / LOOP_SECONDS` 的整数倍频率的正弦/取模——**第 LOOP 秒的画面必须和第 0 秒完全一致**。
5. **自适应**：画布必须铺满任意窗口尺寸（`resize` 监听 + cover 式缩放），竖屏横屏 4K 都不能崩。
6. **性能红线**：优先离屏绘制静态背景；每帧避免大循环里的对象分配；目标 1080P 下 CPU < 15%、GPU < 30%。测试过再交付。
7. `<title>` 就是壁纸/宠物的名字。
8. 首行注释声明类型（容器识别用，可选但推荐）：
   - 壁纸：`<!-- pixel-wallpaper {"format":1,"type":"wallpaper"} -->`
   - 宠物：`<!-- pixel-wallpaper {"format":1,"type":"pet"} -->`

### 壁纸专属规则

- 全屏绘制，`object-fit: cover` 语义（铺满、居中、可以裁边）
- 骨架模板：

```html
<!doctype html>
<!-- pixel-wallpaper {"format":1,"type":"wallpaper"} -->
<html><head><meta charset="utf-8"><title>壁纸名</title>
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden}
  canvas{position:absolute;image-rendering:pixelated}
</style></head><body>
<canvas id="c" width="320" height="180"></canvas>
<script>
"use strict";
// 画完一帧 = draw(t)；t 永远在 [0, LOOP) 内取模
// 静态背景画进离屏 canvas，每帧只 drawImage 一次
// 动态元素全部用 Math.sin((t/LOOP)*6.283*n + 相位) 驱动
// resize 时按 cover 比例设置 canvas 的 style 宽高
</script></body></html>
```

- 视频壁纸不需要写代码：直接给 `.mp4` / `.gif` 文件即可（软件会自动生成循环播放的包装页）。视频务必**循环友好**（首尾帧接近）。

### 宠物专属规则（type: "pet"）

1. **背景透明**：`html,body{background:transparent}`，画布里只画宠物本体。
2. **画布尺寸自适应宠物槽**：容器给每只宠物一个固定槽（宽 = 屏宽的 20%），宠物画布应缩放到占槽较小边的 **55% 左右**（参考：`const s = Math.min(innerWidth, innerHeight) * 0.55 / 画布宽`），居中显示。不要铺满全屏。
3. 宠物画布建议 64×64 或 128×128（小画布放大更清晰），内容居中。
4. 容器把宠物叠加到任意壁纸上，用户可拖动、缩放、旋转、翻转，**位置按壁纸分别记忆**——你不用管摆放，只管把宠物画好、动画循环。
5. 不要写依赖全屏尺寸的逻辑。

### 3D / 着色器场景专属规则（type: "wallpaper"）

想 WebGL/WebGPU 画 3D 山谷、宇宙、体素城市？可以，容器内核带完整 GPU 加速。额外规则：

1. **零依赖**：不引 three.js 等 CDN/文件库——要么手写 WebGL（推荐，`examples/aurora-valley-3d.html` 是完整范例），要么把库完整内嵌进单文件（体积自担，一般不建议）。
2. **循环豁免**：持续演化的 3D/着色器场景允许不做无缝循环（标注 `"loop":0`），但**静止时画面必须稳定**——时间 t 只由自己累加，页面隐藏时暂停累加（`document.hidden` 跳过），防止回来时时间跳变。
3. **性能红线更严**：全屏 fragment shader 逐像素算，DPI 上限 1.5（`Math.min(devicePixelRatio, 1.5)`），帧率上限 30fps（时间闸门节流），复杂 fbm 分层数≤4。目标 1080P 下 GPU < 30%。
4. **不依赖鼠标/键盘事件**：壁纸窗口收不到输入（图标层拦截），鼠标交互用 `window.wallMouse` 钩子（见上文）。
5. 贴图/模型只用程序化生成或 base64 内嵌（`img-src data: blob:` 白名单内）。

### 1080P / 高清 WebGL 壁纸范式（什么时候脱离像素画布）

**判断标准**：题材的观感来自**高频细节**（水面波光焦散、玻璃、流体、云雾、丝绸）时，320×180 的 CPU 像素管线表达不了（内置场景是 JS 逐像素画进 `meta.size` 缓冲，1080P=200 万像素每帧，画不动）——直接写 WebGL 着色器，让 GPU 逐像素渲染。低频平涂题材（剪影、色带、粒子）留在像素管线里。

已验证范式（完整范例：`examples/daisy-pond-1080p.html`，16 KB 单文件，2026-11-21 上桌验收）：

1. **首行注释**：`<!-- pixel-wallpaper {"format":1,"type":"wallpaper","loop":0} -->`（持续演化型标 loop:0）。
2. **全屏三角形 + fragment shader**：一个 `TRIANGLE_STRIP` 四顶点，全部画面在一个 fragment shader 里算；手写 WebGL（照 aurora-valley-3d.html 的 compile/link 骨架）。
3. **时间纪律**：t 只在 `!document.hidden` 时累加（隐藏跳过 + 回来时用 `now - prev` 续，不跳变）；`wallSpeed(v)` 乘在累加步长上。
4. **性能三闸门**：DPR ≤ 1.5、30fps 时间闸门、着色器迭代次数固定（焦散 warp ≤4 层、fbm ≤4 层）。
5. **水面类着色器配方**（已踩平的坑）：
   - 焦散光网用**经典迭代正弦扭曲**算法（KJ 式）：`p = mod(uv*TAU, TAU) - 250.0` 这一步**不能省**——省了输出是均匀泛白不是网；
   - 波浪 = 多层行进正弦（长涌浪 + 中浪 + 细浪），存 `(h, dh/dx, dh/dy)` 一份导数同时喂打光和焦散折射；
   - 亮度增减系数要小（坡度×≤2）：亮底色再叠光会整片过曝白屏（踩过两版全白）；
   - 亮区的焦散强度随底色亮度衰减（`×(1-k·亮度)`），否则清水过曝；
   - 波峰闪光辉度用 hash 网格 + 窄脉冲正弦；
   - 涟漪 = 解析环 `exp(-((d-r)·宽)^2)`，鼠标交互涟漪另开一组 uniform 环（环形缓冲 10 个，age 超时剔除）。
6. **鼠标交互**：`window.wallMouse(nx, ny)`（外壳轮询推送，见钩子节）→ 页面环形缓冲记点 + 能量值随移动积累、静止衰减，着色器里画扩散环 + 尾迹。
7. **交付自检**：普通浏览器双击打开能跑（WebGL1 即可）；断网可跑；任务管理器看 GPU 占用；桌面真机验收鼠标涟漪。

### 可选钩子（让软件的滑杆能控制你的壁纸）

- `window.wallSpeed(v)` — 软件的"速度"滑杆会调用它（v=1.0 正常速度）。内部把你的时间累积乘以 v 即可（参考 `examples/aurora-valley-3d.html`）。**不实现也能用**，只是速度滑杆对你的壁纸无效；视频壁纸自动支持。
- `window.wallMouse(nx, ny)` — 鼠标交互钩子。壁纸窗口在图标层之下收不到鼠标事件，**外壳每 40ms 轮询一次光标**（GetCursorPos），光标在壁纸区域内移动时调用 `window.wallMouse(nx, ny)`（nx/ny 已归一化到窗口 0..1，**y 向下**）。实现它就能做鼠标涟漪、跟随气流等交互；在普通浏览器里预览时自己再挂一个 `mousemove` 兜底（参考 `examples/daisy-pond-1080p.html`）。外壳只在光标移动时才推，静止时零流量。
- `window.wallClick(nx, ny)` — 点击钩子：外壳检测到壁纸区域内的左键按下（GetAsyncKeyState 边沿）时调用，坐标同 wallMouse。浏览器里用 `mousedown` 兜底。注意它是全局输入——用户点别的应用也会触发，交互设计要容忍这点（比如只是溅一下水花）。
- `window.wallParams` + `window.wallParam(key, value)` — **壁纸自带调参**。壁纸把参数清单放在 `window.wallParams`（数组：`{key, label, min, max, step, def}`，label 用作者自己的语言），实现 `window.wallParam(key, value)` 接收数值。设置页会出现「此壁纸的参数」子面板（每个声明一条滑杆，值按壁纸记忆），桌面与预览都会把值推送进来。范例见 `examples/daisy-pond-1080p.html`（焦散强度/雏菊数量/鼠标扰动）。无声明的壁纸只有全局速度滑杆，完全兼容。
- 壁纸页面收不到任何鼠标/键盘事件，也不要指望 iframe 内向软件上报消息（宿主不接收）。

---

## 自检清单（交付前逐条过）

- [ ] 单文件，无任何外部 URL（搜一遍 `http`，data URI 除外）
- [ ] 断网双击打开，动画照常
- [ ] `t=0` 和 `t=LOOP` 两帧逐像素一致（无缝循环）
- [ ] 把窗口拖成 4K / 竖屏 / 超宽屏，画面铺满不变形不报错
- [ ] 控制台无报错
- [ ] 任务管理器：1080P 全屏 CPU 占用达标
- [ ] （宠物）透明背景，双击打开只看到宠物本体

## 参考实现

`examples/aurora-cabin.html` — 一张完整范例壁纸（极光小屋：渐变天空、极光帷幕、雪丘松林、木屋窗光、飘雪、无缝 14 秒循环）。
`examples/aurora-valley-3d.html` — 一张完整范例 **3D 壁纸**（手写 WebGL 极光山谷：三层锯齿雪山剪影+极光辉光勾边、高空极光幕帘、月亮、星空、飘雪；零依赖、DPR 上限 1.5、30fps 节流、页面隐藏自动暂停）。
`examples/daisy-pond-1080p.html` — 一张完整范例 **1080P 高清 WebGL 壁纸**（阳光水面：三层行进水浪、经典迭代扭曲焦散光网、浑水暗斑、解析涟漪环、SDF 雏菊、鼠标涟漪交互；16 KB 单文件，含 wallMouse 钩子和浏览器 mousemove 兜底）。
`examples/snow-fox.html` — 一只完整范例宠物（原地走路、尾巴摇摆、耳朵抖动的小狐狸，透明背景）。

**先读这两个文件再动笔**，写法、结构、循环手法都照它们的路子来。

## 交付物

一个 `.html` 文件。用户把它放进「像素幻境」设置页的"我的壁纸/宠物 → 加载"即可，软件自动沙箱运行。
