# 设置窗标题栏图标修复
- **Agent**: ZCode  **Task**: 用户反馈"窗口左上角 logo 和提交的不一样"  **时间**: 2026-11-23 05:00

## 改动
SettingsWindow.cs 构造函数加 `Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath)`——exe 已通过 /win32icon 内嵌 app.ico（build.mjs 生成），但窗体从未设置 Icon，标题栏一直显示 WinForms 默认图标（用户截图里的彩色格子）。托盘图标一直是 ExtractAssociatedIcon 同源，故托盘正确、窗口错误。

## 原因
用户截图对比商店提交 logo。

## 影响
exe/MSIX 1.0.2.8 已重建。任务栏与 Alt+Tab 的设置窗图标也会同步纠正（同一 Icon 对象）。

## 验证
build 通过。图标显示为运行时系统行为，需真机确认标题栏/任务栏/Alt+Tab 三处均显示 app.ico。
