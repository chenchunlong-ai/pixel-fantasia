# 引擎级真根因：painter 不收字符串颜色 → 流星/一切字符串色全画成黑
- **Agent**: ZCode  **Task**: 用户复检"流星还是黑尾、星星少"  **时间**: 2026-11-23 03:15

## 改动
meteors.js：LIST 之后统一 `m.C = m.C.map(hex)` 把 6 色 ramp 打包成引擎数值色；meteors.js 增 dy 参数（heaven 调用传 +10——heaven origin y=170，流星表按 origin 180 调的，整条轨迹高出画布 10px 被裁掉，只露出最顶端旧尾迹=用户看到的"黑色拖尾"）；heaven 星星 130 → 300。

## 原因（本轮最重要的发现）
**引擎 painter 只接受打包数值色（hex() 产出），不接受 "#rrggbb" 字符串——字符串会被 put 直接写入 ImageData → 渲染成黑。** meteors.js 从第一天起就把调色板字符串直接传 q.dot/px/glow → 全部黑 → "黑色拖尾/看不见"。原版场景没问题是因为它们的调色板都过 fit() 打包。此前多轮"修复"（换色系/换档位/复刻）都无效，因为根因在颜色格式。
次因：heaven origin y=170 vs 流星表按 180 调 → 轨迹高出画布被裁。

## 教训（写给人看）
1. painter 色 = hex() 打包数，字符串 = 黑。接入任何新绘制代码先检查颜色格式。
2. **out/_harness.bundle.js 是快照**，目检前必须重建 + 每次换唯一文件名防浏览器缓存——本轮" rift 流星可见 1196 暖像素"实为裂缝自带的粉色伤口误报，浪费多轮。
3. 大段索引替换曾切坏 heaven（drawBack/draw 丢失），verify 抓到，git 恢复 + 唯一锚点重做。

## 验证
harness _h18（fresh）：heaven t=1.25 流星金头彩尾弧线清晰可见（截图目检）；rift 同样彩色尾迹；verify 23 条全 ok；build 通过 MSIX 1.0.2.8 已重建。**用户需重新加载（内置场景随 exe，重启 out\msix\PixelPalette.exe 即可）。真机待确认。**
