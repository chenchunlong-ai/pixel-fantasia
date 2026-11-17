#Requires -Version 5.1
<#
  commit.ps1 — 生成合规提交信息 + 撞锁检查 + 提交

  用法：
    git add -A
    .\commit.ps1 -Repo D:\aaa\2D动效pixelfx -Agent 豆包 `
        -Type feat -Scope scenes -Message "接入 6 个 nature 场景" `
        -Why "内容单薄：引擎 244 个效果只暴露了 21 个" `
        -Files "src/effects.js, src/scenes/_nature.js" `
        -Task "内容扩充第 1 批" `
        -Journal "collab/journal/2026-11-18-0130-豆包-nature-scenes.md"

  它做三件事：
    1. 确认有已暂存的改动（没有就报错，不会空提交）；
    2. 检查暂存的文件是否被别人锁住（锁了就不让提交）；
    3. 拼出带 Why / Files / Agent 的提交信息并提交，成功后释放自己在这些文件上的锁。

  只想看将要提交什么：加 -DryRun
  明知锁冲突仍要提交（不建议）：加 -NoClaimCheck
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Repo,

    [Parameter(Mandatory)]
    [string]$Agent,

    [Parameter(Mandatory)]
    [string]$Message,

    [Parameter(Mandatory)]
    [string]$Why,

    [ValidateSet('feat', 'fix', 'docs', 'refactor', 'build', 'chore')]
    [string]$Type = 'chore',

    [string]$Scope = '',

    [string]$Files = '',

    [string]$Task = '',

    [string]$Journal = '',

    [switch]$NoClaimCheck,

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Normalize-RepoPath([string]$p) {
    if (-not $p) { return '' }
    $x = $p -replace '/', '\'
    $x = $x -replace '\\{2,}', '\'
    return $x.Trim('\').Trim()
}

function Test-Overlap([string]$a, [string]$b) {
    $a = Normalize-RepoPath $a
    $b = Normalize-RepoPath $b
    if ($a -eq $b) { return $true }
    if ($a.StartsWith($b + '\', [StringComparison]::OrdinalIgnoreCase)) { return $true }
    if ($b.StartsWith($a + '\', [StringComparison]::OrdinalIgnoreCase)) { return $true }
    return $false
}

function Test-LockActive($lock) {
    if (-not $lock.expires) { return $false }
    try {
        $exp = [datetimeoffset]::Parse([string]$lock.expires, [Globalization.CultureInfo]::InvariantCulture)
        return ($exp -gt [datetimeoffset]::Now)
    }
    catch { return $false }
}

function Get-Locks([string]$repo) {
    $result = @()
    $dir = Join-Path $repo 'collab\locks'
    if (-not (Test-Path -LiteralPath $dir)) { return $result }
    foreach ($f in (Get-ChildItem -LiteralPath $dir -Filter *.json -File -ErrorAction SilentlyContinue)) {
        try {
            $o = Get-Content -LiteralPath $f.FullName -Raw -Encoding utf8 | ConvertFrom-Json
        }
        catch { continue }
        if (-not $o.path) { continue }
        $o | Add-Member -NotePropertyName _file -NotePropertyValue $f.FullName -Force
        $result += $o
    }
    return $result
}

if (-not (Test-Path -LiteralPath (Join-Path $Repo '.git'))) {
    Write-Host "这里不是 git 仓库根（找不到 .git）：$Repo" -ForegroundColor Red
    exit 1
}
$repoRoot = (Resolve-Path -LiteralPath $Repo).Path

# 1) 有东西要提交吗
$staged = @(& git -c core.quotepath=false -C $repoRoot diff --cached --name-only --diff-filter=ACMR)
if ($LASTEXITCODE -ne 0) {
    Write-Host '读取暂存区失败。' -ForegroundColor Red
    exit 1
}
$staged = @($staged | Where-Object { $_ -and $_.Trim() })
if ($staged.Count -eq 0) {
    Write-Host '暂存区是空的：先 git add，再跑这个脚本。' -ForegroundColor Red
    exit 1
}

if (-not $Why.Trim()) { Write-Host '-Why 不能为空：提交必须说明动机。' -ForegroundColor Red; exit 1 }

# 2) 撞锁检查
if (-not $NoClaimCheck) {
    $locks = Get-Locks $repoRoot
    $conflicts = @()
    foreach ($f in $staged) {
        foreach ($l in $locks) {
            if (-not (Test-LockActive $l)) { continue }
            if ($l.agent -eq $Agent) { continue }
            if (Test-Overlap $f $l.path) {
                $conflicts += [pscustomobject]@{
                    文件   = $f
                    持有人 = $l.agent
                    已锁   = $l.path
                    任务   = $l.task
                }
            }
        }
    }
    if ($conflicts.Count -gt 0) {
        Write-Host '以下文件被别人锁着，拒绝提交：' -ForegroundColor Red
        $conflicts | Sort-Object 文件 -Unique | Format-Table -AutoSize -Wrap | Out-String | Write-Host
        Write-Host '要么等对方释放锁，要么在 journal 里协商。确实要提交可加 -NoClaimCheck（不建议）。' -ForegroundColor Yellow
        exit 1
    }
}

# 3) 组装提交信息
$subject = if ($Scope) { "${Type}(${Scope}): $Message" } else { "${Type}: $Message" }

$lines = @($subject, '')
$lines += "Why: $Why"
if ($Files) { $lines += "Files: $Files" }
$lines += "Agent: $Agent"
if ($Task) { $lines += "Task: $Task" }
if ($Journal) { $lines += "Journal: $Journal" }

$body = ($lines -join "`n") + "`n"

Write-Host '将要提交的内容：' -ForegroundColor Cyan
Write-Host '----------------------------------------'
Write-Host $body
Write-Host '----------------------------------------'
Write-Host ("暂存 {0} 个文件：" -f $staged.Count) -ForegroundColor Cyan
$staged | ForEach-Object { Write-Host "  $_" }
Write-Host ''

if ($DryRun) {
    Write-Host '（-DryRun：只预览，没有真的提交）' -ForegroundColor Yellow
    exit 0
}

# 4) 提交
$tmp = [IO.Path]::GetTempFileName()
try {
    [IO.File]::WriteAllText($tmp, $body, (New-Object Text.UTF8Encoding($false)))
    & git -C $repoRoot commit -F $tmp --quiet
    $code = $LASTEXITCODE
}
finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
}
if ($code -ne 0) {
    Write-Host '提交失败，看上面的 git 报错。' -ForegroundColor Red
    exit 1
}

$head = (& git -C $repoRoot log -1 --pretty='%h %s') -join ' '
Write-Host ("提交完成：{0}" -f $head) -ForegroundColor Green

# 5) 释放自己在这些文件上的锁
$released = 0
foreach ($l in (Get-Locks $repoRoot)) {
    if ($l.agent -ne $Agent) { continue }
    $hit = $false
    foreach ($f in $staged) { if (Test-Overlap $f $l.path) { $hit = $true; break } }
    if ($hit) {
        Remove-Item -LiteralPath $l._file -Force
        $released++
        Write-Host ("已释放锁：{0}" -f $l.path) -ForegroundColor Green
    }
}
if ($released -eq 0) {
    Write-Host '（没有需要释放的锁，或锁不在这次提交的文件上）' -ForegroundColor DarkGray
}

exit 0
