#Requires -Version 5.1
<#
  journal.ps1 — 按模板生成一条变更日志

  用法：
    .\journal.ps1 -Repo D:\aaa\2D动效pixelfx -Agent 豆包 -Slug "nature-scenes" -Task "内容扩充" -Summary "接入 nature 场景（第 1 批）"

  产物：collab/journal/YYYY-MM-DD-HHMM-<agent>-<slug>.md
  模板：优先读 collab/journal/_TEMPLATE.md，没有就用内置文本。
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Repo,

    [Parameter(Mandatory)]
    [string]$Agent,

    [Parameter(Mandatory)]
    [string]$Slug,

    [string]$Task = '',

    [string]$Summary = ''
)

$ErrorActionPreference = 'Stop'

function Clean-Name([string]$s) {
    $x = $s -replace '[\\/:*?"<>|]', '-'
    $x = $x -replace '[\s]+', '-'
    $x = $x -replace '-{2,}', '-'
    return $x.Trim('-')
}

if (-not (Test-Path -LiteralPath $Repo)) {
    Write-Host "仓库路径不存在：$Repo" -ForegroundColor Red
    exit 1
}
$repoRoot = (Resolve-Path -LiteralPath $Repo).Path

$journalDir = Join-Path $repoRoot 'collab\journal'
if (-not (Test-Path -LiteralPath $journalDir)) {
    New-Item -ItemType Directory -Path $journalDir -Force | Out-Null
}

$now = Get-Date
$safeAgent = Clean-Name $Agent
$safeSlug = Clean-Name $Slug
if (-not $safeSlug) { $safeSlug = 'change' }

$baseName = '{0}-{1}-{2}' -f $now.ToString('yyyy-MM-dd-HHmm'), $safeAgent, $safeSlug
$fileName = $baseName + '.md'
$filePath = Join-Path $journalDir $fileName
$n = 2
while (Test-Path -LiteralPath $filePath) {
    $fileName = "$baseName-$n.md"
    $filePath = Join-Path $journalDir $fileName
    $n++
}

$title = if ($Summary) { $Summary } else { $safeSlug }

$templatePath = Join-Path $journalDir '_TEMPLATE.md'
if (Test-Path -LiteralPath $templatePath) {
    $body = Get-Content -LiteralPath $templatePath -Raw -Encoding utf8
}
else {
    $body = @'
# {{TITLE}}
- **Agent**: {{AGENT}}  **Task**: {{TASK}}  **时间**: {{DATE}} {{TIME}}

## 改动
（改了哪些文件、各改了什么。）

## 原因
（为什么改。）

## 影响
（要重跑哪些产物；版本号要不要动；有没有连带改动。）

## 验证
（跑了什么验证；没跑就写“未跑 + 原因”。）
'@
}

$body = $body.Replace('{{TITLE}}', $title)
$body = $body.Replace('{{AGENT}}', $Agent)
$body = $body.Replace('{{TASK}}', $Task)
$body = $body.Replace('{{DATE}}', $now.ToString('yyyy-MM-dd'))
$body = $body.Replace('{{TIME}}', $now.ToString('HH:mm'))
$body = $body.Replace('{{SLUG}}', $safeSlug)

[IO.File]::WriteAllText($filePath, $body, (New-Object Text.UTF8Encoding($false)))

Write-Host ("已生成变更日志：collab/journal/{0}" -f $fileName) -ForegroundColor Green
Write-Host '打开它，把“改动 / 原因 / 影响 / 验证”四段填完再提交。' -ForegroundColor Yellow
exit 0
