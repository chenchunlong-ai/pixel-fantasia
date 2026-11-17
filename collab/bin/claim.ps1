#Requires -Version 5.1
<#
  claim.ps1 — 文件级软锁（collab 协议的一部分）

  用法：
    .\claim.ps1 claim   -Repo D:\aaa\2D动效pixelfx -Agent 豆包 -Task "接入 nature 场景" -Paths "palette-wallpaper\src\effects.js" -Hours 4
    .\claim.ps1 list    -Repo D:\aaa\2D动效pixelfx
    .\claim.ps1 check   -Repo D:\aaa\2D动效pixelfx [-Clean]
    .\claim.ps1 release -Repo D:\aaa\2D动效pixelfx -Agent 豆包 [-Paths ...]

  规则：
    - 路径可以写目录，目录锁覆盖整棵子树；
    - 默认 4 小时过期，过期锁可被抢（抢的人要在 journal 里写明接手）；
    - 退出码 0 = 成功，1 = 有冲突或参数不对。
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [ValidateSet('claim', 'release', 'list', 'check')]
    [string]$Action,

    [Parameter(Mandatory)]
    [string]$Repo,

    [string[]]$Paths,

    [string]$Agent = $env:COLLAB_AGENT,

    [string]$Task = '',

    [double]$Hours = 4,

    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

function Normalize-RepoPath([string]$p) {
    if (-not $p) { return '' }
    $x = $p -replace '/', '\'
    $x = $x -replace '\\{2,}', '\'
    return $x.Trim('\').Trim()
}

function ConvertTo-LockKey([string]$p) {
    return ($p -replace '[\\/:*?"<>|]', '~')
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

function Get-LockDir([string]$repo) {
    $d = Join-Path $repo 'collab\locks'
    if (-not (Test-Path -LiteralPath $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
    return $d
}

function Get-Locks([string]$dir) {
    $result = @()
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

function Remaining-Text($lock) {
    try {
        $exp = [datetimeoffset]::Parse([string]$lock.expires, [Globalization.CultureInfo]::InvariantCulture)
        $left = $exp - [datetimeoffset]::Now
        if ($left.TotalSeconds -le 0) { return "已过期 $([math]::Abs([math]::Round($left.TotalHours,1))) 小时" }
        if ($left.TotalHours -lt 1) { return "$([math]::Round($left.TotalMinutes,0)) 分钟" }
        return "$([math]::Round($left.TotalHours,1)) 小时"
    }
    catch { return '（无到期时间）' }
}

# ---------- 入口 ----------
if (-not (Test-Path -LiteralPath $Repo)) {
    Write-Host "仓库路径不存在：$Repo" -ForegroundColor Red
    exit 1
}
$repoRoot = (Resolve-Path -LiteralPath $Repo).Path
$lockDir = Get-LockDir $repoRoot
$locks = Get-Locks $lockDir

$cleanPaths = @()
if ($Paths) {
    $cleanPaths = @($Paths | Where-Object { $_ -and $_.Trim() } | ForEach-Object { Normalize-RepoPath $_ })
}

switch ($Action) {

    'claim' {
        if (-not $Agent) {
            Write-Host '缺少 -Agent（或设置环境变量 COLLAB_AGENT）' -ForegroundColor Red
            exit 1
        }
        if ($cleanPaths.Count -eq 0) {
            Write-Host 'claim 需要 -Paths：要改的文件或目录（目录会锁整棵子树）' -ForegroundColor Red
            exit 1
        }

        $conflicts = @()
        foreach ($p in $cleanPaths) {
            foreach ($l in $locks) {
                if (-not (Test-LockActive $l)) { continue }
                if ($l.agent -eq $Agent) { continue }
                if (Test-Overlap $l.path $p) {
                    $conflicts += [pscustomobject]@{
                        目标   = $p
                        持有人 = $l.agent
                        已锁   = $l.path
                        任务   = $l.task
                        剩余   = (Remaining-Text $l)
                    }
                }
            }
        }

        if ($conflicts.Count -gt 0) {
            Write-Host '有文件已被别人锁住，本次未写入任何锁：' -ForegroundColor Red
            $conflicts | Format-Table -AutoSize | Out-String | Write-Host
            Write-Host '处理办法：改去别的文件；或等对方释放；或在 collab/journal 里留言协调。' -ForegroundColor Yellow
            exit 1
        }

        $now = Get-Date
        $exp = $now.AddHours($Hours)
        foreach ($p in $cleanPaths) {
            $obj = [ordered]@{
                path     = $p
                agent    = $Agent
                task     = $Task
                since    = $now.ToString('o')
                ttlHours = $Hours
                expires  = $exp.ToString('o')
            }
            $file = Join-Path $lockDir ((ConvertTo-LockKey $p) + '.json')
            [IO.File]::WriteAllText($file, ($obj | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))
            Write-Host ("已锁定 {0}  →  {1:yyyy-MM-dd HH:mm} 到期" -f $p, $exp) -ForegroundColor Green
        }
        Write-Host ''
        Write-Host "下一步：写一条变更日志  .\journal.ps1 -Repo `"$repoRoot`" -Agent `"$Agent`" -Slug 任务名" -ForegroundColor Cyan
    }

    'release' {
        if (-not $Agent) {
            Write-Host '缺少 -Agent：释放谁的锁？' -ForegroundColor Red
            exit 1
        }
        $mine = @($locks | Where-Object { $_.agent -eq $Agent })
        if ($cleanPaths.Count -gt 0) {
            $keep = @()
            foreach ($l in $mine) {
                $hit = $false
                foreach ($p in $cleanPaths) { if (Test-Overlap $l.path $p) { $hit = $true; break } }
                if (-not $hit) { $keep += $l } else {
                    Remove-Item -LiteralPath $l._file -Force
                    Write-Host ("已释放 {0}" -f $l.path) -ForegroundColor Green
                }
            }
            if (-not $keep) { }
        }
        else {
            foreach ($l in $mine) {
                Remove-Item -LiteralPath $l._file -Force
                Write-Host ("已释放 {0}" -f $l.path) -ForegroundColor Green
            }
        }
        if (-not $mine) { Write-Host "$Agent 当前没有锁。" -ForegroundColor Yellow }
    }

    'list' {
        if ($locks.Count -eq 0) {
            Write-Host '（当前没有任何锁）' -ForegroundColor Yellow
            exit 0
        }
        $rows = $locks | ForEach-Object {
            [pscustomobject]@{
                状态   = if (Test-LockActive $_) { '持有中' } else { '已过期' }
                Agent  = $_.agent
                任务   = $_.task
                路径   = $_.path
                剩余   = (Remaining-Text $_)
            }
        }
        $rows | Format-Table -AutoSize -Wrap | Out-String | Write-Host
    }

    'check' {
        $expired = @($locks | Where-Object { -not (Test-LockActive $_) })
        if ($expired.Count -eq 0) {
            Write-Host '没有过期锁，现场干净。' -ForegroundColor Green
            exit 0
        }
        $expired | ForEach-Object {
            [pscustomobject]@{
                Agent = $_.agent
                任务  = $_.task
                路径  = $_.path
                已过期 = (Remaining-Text $_)
            }
        } | Format-Table -AutoSize -Wrap | Out-String | Write-Host

        if ($Clean) {
            foreach ($l in $expired) {
                Remove-Item -LiteralPath $l._file -Force
                Write-Host ("已清理过期锁：{0}（{1}）" -f $l.path, $l.agent) -ForegroundColor Green
            }
        }
        else {
            Write-Host '加 -Clean 可以顺手清掉这些过期锁。' -ForegroundColor Yellow
        }
    }
}

exit 0
