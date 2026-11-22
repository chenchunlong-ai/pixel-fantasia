# 星星档位可见化 + 共享流星系统（三场景）+ 版本 1.0.2.8
- **Agent**: ZCode  **Task**: 用户复检（星星没分层/流星太单一）+ 版本  **时间**: 2026-11-22 23:39

## 改动
1. **heaven 星星档位可见化**：上轮的档位在像素上不可辨（dot 1px + alpha 被银河带淹没、颜色被 mix 进 MW_CORE 洗白）。本轮：亮星改 `q.circle` 真 2-3px 圆盘（tier2 r1.1 / tier3 r1.5），颜色 mix 只压到 0.3 保留蓝紫/暖色调，闪烁频率除 1.6 放慢（周期 5~25s，仍 5 档）
2. **共享流星系统 `src/fx/meteors.js`（新文件）**：忠实移植 shooting-stars 的 meteor 工艺（头部燃尽/冷却尾迹/大流星 flare+碎片/发光扭曲 train），调度改为**循环分数**（适配任何 D），一循环 8 颗、每颗位置/角度/速度/长度/大小/配色/时刻全不同；四套配色（金/玫红/蓝/橙/紫）
3. **三场景接入**：heaven（seed 71）、rift（seed 83）、otherworld-rift（seed 97）的 draw() 里 bigStars 后调用 drawMeteors；heaven 删旧的单颗 meteor()
4. **版本 1.0.2.1 → 1.0.2.8**

## 原因
用户复检：星星只有一种方块、颜色全白、闪烁太快、流星单一；要求升级版流星多次出现且每次不同，并加到两个裂缝壁纸。

## 影响
exe 533 KB / MSIX `4A5AB34E.62945D70D0F14_1.0.2.8_x64.msix` 已重建。rift.draw 补了 `const q = q2(p)`（原 draw 无 q，首次接线时报 q is not defined——verify 抓到）；otherworld 的 import 行模式不同首次漏挂（drawMeteors is not defined——verify 抓到）。

## 验证
**教训沿用：harness 目检必须 fresh bundle + 唯一文件名（本轮 _h4）**。像素采样实测：heaven 流星头部亮度 654 vs 基线 486（可见）；rift 顶部亮像素 2.85s→567 / 3.75s→864 / 9.9s→579（流星在场）；heaven t=7.3 目检：星盘/中星/微点/蓝紫色调层次分明。verify 23 条全 ok；build 通过。
