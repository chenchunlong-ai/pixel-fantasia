# GPL-3.0 + rift 雷暴风闪电三样式 + sandstorm 清理收尾 + heaven 四修
- **Agent**: ZCode  **Task**: 用户点名 2026-11-22  **时间**: 2026-11-22 22:49

## 改动
1. **LICENSE → GPL-3.0**（gnu.org 官方全文 674 行）；README 徽章/尾注、palette-wallpaper/README 说明（MIT 上游可并入 GPL，署名保留）、NOTICE.md 字样同步。上游 MIT 归属行保留不动
2. **rift 闪电回归、雷暴工艺三样式**：energy() 每次放电按 rand 选样式——①strike out（主干从裂缝内劈出越唇入太空+1 分叉）②fork burst（三点侧向短雷爆）③along-spine arc（沿撕裂线跳电）。绘制用 _tornado 的三层 stroke 工艺（暗鞘/淡体/白热芯 q.circle 三 pass+glow），色 ramp V=[HALO→ICE→ARC→白]。原 rays/sparks/chips/冲击环保留
3. **sandstorm**：_tornado.js 加 `noBolt` 开关，TH.noBolt=true 去雷击；删 groundFront 整块（点状拖尾仍读作横线）、debris 空中拖尾、gust swirls（圆圈环）；只剩沙丘滚动/落沙/跳粒。desc 同步
4. **heaven 四修**：天空色带改纯黑系（顶部纯 BLACK，七带整体压暗）；银河减淡约 45%（veil 0.09→0.05 / arm 0.22→0.12 / core 0.8→0.45 / 边缘星尘 0.22→0.12）；沿缝星 1500→1050；**循环卡顿修复**：far() 的 `9*(t/D)` 是未回绕的线性漂移，t 到 16s 回绕瞬间云跳 9px——改 7*sin(ph+k*1.3)（周期项无接缝）

## 原因
用户点名四项；协议拍板 GPL-3.0（上轮建议）。

## 影响
**协议注意**：商店 Partner Center 的"许可条款"字段若填过 MIT 需手动同步为 GPL-3.0；README 徽章已改。rift 的 tree/stroke 每帧计算量增，verify 帧率未测（harness 渲染正常）。

## 验证
harness 抽帧目检：t=0.5/2.67/6.32 三种样式闪电均正常（白热芯+品红鞘，形态各异）；verify.mjs 23 条全 ok（heaven paletteΔ 98%）；build 通过 MSIX 1.0.2.1。真机目检待用户。
