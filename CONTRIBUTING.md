# 贡献指南 / Contributing

感谢你对「像素幻境」的兴趣！欢迎 Issue 和 PR。

## 提 Issue

- **Bug**：用 Bug 模板。务必附上：Windows 版本、显卡型号、复现步骤、`%LOCALAPPDATA%\PixelPalette\log.txt` 尾部（如有）。
- **新场景/新功能建议**：用 Feature 模板，描述期望效果即可，实现交给维护者。

## 提交 PR

1. Fork → 从 `main` 拉分支（命名如 `feat/xxx` 或 `fix/xxx`）；
2. 改动后本地验证：
   ```bash
   node palette-wallpaper/verify.mjs          # 场景验证
   node palette-wallpaper/build.mjs           # 能完整构建
   ```
3. 场景类改动请附渲染帧截图（`node palette-wallpaper/shot.mjs <id> <秒> out.png`）；
4. PR 描述写清：改了什么、为什么、怎么验证的。

## 代码约定

- 内置场景是**纯时间函数**：位置 = f(t)，随机数用 `rand(seed,…)`，保证无缝循环与确定性；
- 不改引擎原文件（`src/core`、引擎特效），新增场景放 `palette-wallpaper/src/fx/` 并注册进 `effects.js`；
- 用户可见文案进 `src/i18n.json`（9 国语言都要补）；
- C# 外壳禁用 `Process.Start` / `ShellExecute`（WACK 会 FAIL），开链接用"复制到剪贴板"。

## 版本发布（维护者）

改 `palette-wallpaper/version.mjs`（递增）→ build → 打 tag `v<版本>` → GitHub Release 附安装器与 MSIX。
