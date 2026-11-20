# 新场景「雏菊水塘」daisypond（用户参考图：清透水面+波光+小雏菊）
- **Agent**: ZCode  **Task**: 内容扩充（内置场景）  **时间**: 2026-11-21 01:57

## 改动
新增 `palette-wallpaper/src/fx/daisypond.js`（俯视水面：烘焙渐变水体+浑水暗斑、Voronoi 焦散光网两张瓦片滑动、星光闪烁、涟漪环、6 朵雏菊漂移）；注册 `src/effects.js` + `src/params.js` + `src/i18n.json`（9 语言 fxDaisyPond）【跨区：params.js/i18n.json 属双签区】

## 原因
用户按参考图（水面波光粼粼、漂浮雏菊、阳光清澈）点单，选内置场景路线（同 gorgefall/天堂）

## 影响
场景 24 → 25；设置页列表新增「雏菊水塘」；支持 27 套调色板换装；exe 需重建后真机可见

## 验证
`verify.mjs` 全部 ok（daisypond paletteΔ 100%）；逐帧目检 5 帧（t=0/2/6/10/14，PNG 在 `D:\AAAAA\ShiPin\1\work\fx-preview\雏菊水塘-*.png`）：有机焦散网+雏菊+涟漪成形；无缝循环 t=0 vs t=16 **逐像素 0 差异**；draw **13.5–17 ms/帧**（30fps 预算 33ms，含 composite）。**真机未验收、exe 未重建**

## 踩坑记录（给下一个改场景的人）
1. 逐像素 blend（pass + o.b=1）实测 **66 ms/帧**——改「预混合 LUT」（调色板变化时一次把 8 档焦散强度与底色 mix 好，逐帧查表）降到 ~8 ms
2. `field()` 采样尺度：八度波长是格点单位，x*0.011 时粗八度被放大到 ~4000px 只剩平台硬边；暗斑用 x*0.16 才出 ~60px 特征
3. 漂移相位的无缝纪律：线性滑动每循环必须恰好整数个瓦片（20px/s=320px/16s）；正弦相位进 warp 后若被 1.7/1.6 之类非整数系数放大就破循环（t=0 vs t=D 差 40041 像素）——漂移相位只能以整数系数进入任何 sin
4. `q.ellipse` 是实心填充，低 alpha 被 Bayer 抖成点阵方块（涟漪/阴影翻车）——细环用 `q.ring`，阴影压到 alpha 0.13
