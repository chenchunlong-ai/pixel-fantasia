# 设置页：本地壁纸并入"当前壁纸" + 窗口默认 16:9
- **Agent**: ZCode  **Task**: UI 改进（用户点名）  **时间**: 2026-11-21 13:22

## 改动
settings.html 砍掉独立「本地壁纸」卡片，其 加载/删除/恢复 三按钮并入场景卡片"当前壁纸"下方的 mineRow；settings.js 的下拉改为 optgroup 两组（系统壁纸/本地壁纸），删除按钮仅选中本地壁纸时可用，恢复按钮改发 `restoreHidden{wallpapers:true}`（只恢复被隐藏的用户壁纸，不再动 hiddenFx）；旧 wallRow 列表/hiddenNote 随卡片一起移除；SettingsWindow.cs 默认尺寸 1020×800 → 1152×648（16:9）；i18n.json 新增 optSystem（9 语种）+ mineTitle 补齐 7 语种。

## 原因
用户要求：本地壁纸入口并入"当前壁纸"（分系统/本地两组，可加载、删除、恢复）；设置窗打开默认 16:9 小弹窗而非 1:1。

## 影响
设置页双签区（settings.html/js/i18n.json）+ 外壳方 SettingsWindow.cs，已声明锁；行为变化：本地壁纸的逐条"使用/隐藏"按钮没了（改为下拉直接选 + 恢复按钮）；布局在 1152 宽下预览卡片换到右侧（.side flex 自动生效）。

## 验证
node verify.mjs 全部场景 ok（26 条 paletteΔ ≥98%）；node build.mjs 通过，MSIX 0.8 MB 产出 out\4A5AB34E.62945D70D0F14_1.0.0.0_x64.msix；未跑真机目检（新窗口布局与下拉分组需 out\msix\PixelPalette.exe 人工确认）。
