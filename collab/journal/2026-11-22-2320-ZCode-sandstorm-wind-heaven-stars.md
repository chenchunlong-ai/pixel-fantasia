# sandstorm 风线补刀 + heaven 星空按流星壁纸工艺重做
- **Agent**: ZCode  **Task**: 用户复检反馈两项  **时间**: 2026-11-22 23:20

## 改动
1. **sandstorm 飞线补刀**：上轮漏了 `_tornado.js` 的 `wind()`（全屏横穿长条纹）——加 `noWind` 开关，TH.noWind=true。落沙 `fall` 加量（near 40→60 / far 70→105 × DEN）。desc/tags 同步
2. **heaven 星空按 shooting-stars 工艺重做**：
   - 星表构建期量化：**3 档大小**（tier 0 dot/1 mid/2 bright+halo/3 glint）、**5 档亮度**（m 量化 0.18+0.18n）、**5 个闪烁频率**（w=整数 1..5）、约 1/3 星星带微蓝(#b9c8ff)/微紫(#c4b8ff)色偏
   - 数量 1390 → 460（沿缝 340 + 散布 120）；亮档占比压缩（tier 阈值 .6/.92/.985）
   - **亮度必须走 q.dot 的 alpha**：q.px 是实心，会把五档亮度压成一样的白块（第一版像下雪）
   - 银河 granulation 花斑 0.72→0.9 阈值减半、bloom k 0.1→0.04（白茫主因）
3. **重大教训：out/_harness.bundle.js 是 11-19 的旧 esbuild 产物**——上轮"rift 三样式目检通过"实际渲染的是缓存旧代码；本轮用每次换唯一文件名（_h2/_h3）的方式强制刷新后重验：rift 三样式真实存在且效果好、sandstorm 确认干净、heaven 新星空确认。**以后 harness 目检必须先重建 bundle + 唯一文件名防缓存**

## 原因
用户复检：沙尘暴飞线仍在（wind()）、天堂星星要分层/银河减量/学流星壁纸。

## 影响
exe 532 KB / MSIX 1.0.2.1 已重建。沙尘暴只剩沙丘/厚落沙/跳粒；天堂纯黑天空+暗银河+460 颗分层星。

## 验证
新 bundle 目检：sandstorm t=4.2 无任何线/圆；heaven t=6.5 纯黑天空+暗带+分层星（_h3 强制刷新帧）；verify.mjs 23 条全 ok；build 通过。真机待用户。
