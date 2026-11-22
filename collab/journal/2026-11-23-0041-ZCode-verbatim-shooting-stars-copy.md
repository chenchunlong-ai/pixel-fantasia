# 天堂星星/流星逐字复刻流星壁纸 + 裂缝流星同步复刻
- **Agent**: ZCode  **Task**: 用户点名"直接抄流星壁纸"  **时间**: 2026-11-23 00:41

## 改动
1. **meteors.js**：调度表和调色板整个换成 shooting-stars 原版——原 7 颗的 t0/x/y/角度/速度/寿命/大小/flare 参数逐字保留（t0 换算成循环分数），全部用原版 6 色 ramp（#3a1e5a→#7a3a8a→#e0607a→#ffa86a→#ffe6a8→#ffffff）
2. **heaven 星空**：删掉自造的 STARS 表/milkyStars，逐字复刻 shooting-stars 的 130 颗星循环（dim dot / px / px+glow / sparkle 十字，4 频闪烁，同种子结构）；唯一改动=星色调亮（K[3] #8e8ec4→#e8e8ff、K[4]→#ffffff）——原版的紫灰星在它自己的暗天空是亮点，在天堂的亮银河带上会变成暗斑。加 HZ-14 边界守卫（星不出云海）。云海/月亮未动
3. rift / otherworld-rift 的流星随 meteors.js 一起变成原版复刻

## 原因
用户点名：一字星不像星星，直接抄流星壁纸的星星和流星；云彩月亮不要动。

## 影响
heaven 星空回到与流星壁纸一致的观感（白亮点+十字 glint 稀疏 130 颗）；三场景流星统一原版参数。上轮的自造档位版本废弃。

## 验证
harness _h7 目检：天堂星点为白亮色（带内外都可见）、sparkle 十字正常、flare 流星在 7.6s 触发；rift 3.3s 流星拖尾可见；verify 23 条全 ok；build 通过（exe 532 KB / MSIX 1.0.2.8）。真机待用户。
