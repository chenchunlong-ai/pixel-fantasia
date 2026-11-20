# 外壳检测点击（wallClick）恢复桌面点击双环 + 暗斑减淡
- **Agent**: ZCode  **Task**: 交互手感  **时间**: 2026-11-21 04:15

## 改动
`shell/Wallpaper.cs` 轮询加 `GetAsyncKeyState(VK_LBUTTON)` 边沿检测：壁纸区域内左键按下 → `window.wallClick(nx,ny)`（全局输入，其他应用点击也会落，可接受）；`shell/Native.cs` 加 GetAsyncKeyState；`src/wallwrap.js` 加 wallClick 转发进 iframe；壁纸 HTML 恢复点击双环（uRip 复位）+ 湍流斑暗部减淡（0.12→0.05、churn 1.1→0.9）

## 原因
用户：点击的水波纹该有不该丢；暗斑有的黑有点明显

## 影响
所有实现 wallClick 的 ext 壁纸获得桌面点击能力；exe 575 KB 重建部署重启（PID 25596）；SKILL.md 钩子文档未同步 wallClick（待补）

## 验证
build 通过、部署重启正常推帧；浏览器 mousedown → 双环路径复用旧实现（此前已目检）；**真机桌面点击待用户验收**；暗斑强度待用户确认
