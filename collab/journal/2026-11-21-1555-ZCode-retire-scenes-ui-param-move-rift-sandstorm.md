# 下线两场景 + 参数面板挪位 + rift 去闪电 + sandstorm 去线条
- **Agent**: ZCode  **Task**: 用户点名四项  **时间**: 2026-11-21 15:55

## 改动
1. **下线 palette/daisypond 与 palette/gorgefall**：effects.js 摘 import+注册、params.js 摘参数行、i18n.json 删 fxDaisyPond/fxGorgefall（9 语种共 18 条）；源文件 fx/daisypond.js、fx/gorgefall.js、fx/canyonfall.js 加 `// DRAFT — not shipped.` 头。normalize() 的失效回退（地狱下线时加的）自动处理旧配置里的引用（回退 weather/snow、rules/cycle 剔除）
2. **参数面板挪进场景卡片**：settings.html 删独立「此壁纸的参数」卡片，`#params` 移到场景卡片内 fpsHint 之后、背景行（border-top 分隔）之前
3. **rift 去闪电**：energy() 摘掉 1) bolts/forks 和 2) internal crackle（tree/Rng 螺栓绘制），保留 rays/sparks/chips/lip flare/冲击环/热核/能量脉络（surge 驱动的裂缝内脉络仍在，放电仍在只是没有螺栓形状）；meta desc 同步更新
4. **sandstorm 去直线条纹**：groundFront 的 q.line 沙线 → 4 粒点状拖尾（sin 抖动、渐隐）；debris 的空中沙线 → 5 粒点状拖尾

## 原因
用户点名：2D 版雏菊水塘/峡谷晨雾删除；参数面板要贴着场景；闪电去掉也可以（lightning11 视频素材不适合程序化管线，直接去）；沙尘暴的直线"不像沙子"。

## 影响
场景 25 → 23；exe 591→532 KB / Setup 921→862 KB / MSIX 1.0.2.1 已重建。旧配置里选过这两场景的用户回退到 weather/snow。**用户若要基于 lightning11 素材的闪电**，那是视频/序列帧路线，与本程序化管线不合，本次按用户许可直接移除。

## 验证
verify.mjs 23 条全 ok（paletteΔ ≥98%）、daisypond/gorgefall 不再出现；build.mjs 通过。真机目检沙尘暴无直线、裂缝无闪电待用户确认。
