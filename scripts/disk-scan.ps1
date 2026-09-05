# Find what is actually using the disk.
#
# RUN THIS ELEVATED. An unelevated scan silently skips every folder it cannot
# read — which on Windows is a lot — and the missing space then looks like a
# mystery rather than a permissions artefact. That is exactly what happened:
# a normal walk accounted for ~293 GB of ~709 GB in use.
#
#   Right-click Start > Windows PowerShell (Admin), then:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\BlackPineOps\Desktop\codeearly-2.0\scripts\disk-scan.ps1"

$ErrorActionPreference = 'SilentlyContinue'

function Get-DirSize {
    param([string]$Path)
    $sum = 0
    try {
        # Enumerate rather than collect: a folder with a million files should not
        # be materialised into memory just to be measured.
        $files = [System.IO.Directory]::EnumerateFiles($Path, '*', [System.IO.SearchOption]::AllDirectories)
        foreach ($f in $files) {
            try { $sum += (New-Object System.IO.FileInfo $f).Length } catch {}
        }
    } catch {}
    return $sum
}

$drive = Get-PSDrive C
$usedGB = [math]::Round($drive.Used / 1GB, 1)
$freeGB = [math]::Round($drive.Free / 1GB, 1)

Write-Host ""
Write-Host "C:  used $usedGB GB   free $freeGB GB" -ForegroundColor Cyan
Write-Host ""
Write-Host "Scanning. This walks the whole disk and takes several minutes." -ForegroundColor DarkGray
Write-Host ""

# Every top-level folder, plus one level inside the usual suspects, so a single
# fat subfolder is named rather than hidden inside a 160 GB total.
$roots = @()
$roots += Get-ChildItem 'C:\' -Directory -Force | ForEach-Object { $_.FullName }
foreach ($parent in @('C:\Users', 'C:\ProgramData', 'C:\Program Files', 'C:\Program Files (x86)')) {
    $roots += Get-ChildItem $parent -Directory -Force | ForEach-Object { $_.FullName }
}
foreach ($profile in (Get-ChildItem 'C:\Users' -Directory -Force)) {
    foreach ($sub in @('AppData\Local', 'AppData\Roaming', 'Documents', 'Downloads', 'Videos', 'Pictures', 'Desktop', 'OneDrive')) {
        $p = Join-Path $profile.FullName $sub
        if (Test-Path $p) { $roots += $p }
    }
}

$results = @()
foreach ($r in ($roots | Sort-Object -Unique)) {
    $bytes = Get-DirSize $r
    if ($bytes -gt 2GB) {
        $results += [pscustomobject]@{ GB = [math]::Round($bytes / 1GB, 1); Path = $r }
        Write-Host ("{0,8:N1} GB  {1}" -f ($bytes / 1GB), $r)
    }
}

Write-Host ""
Write-Host "=== BIGGEST, sorted ===" -ForegroundColor Cyan
$results | Sort-Object GB -Descending | Select-Object -First 30 |
    ForEach-Object { "{0,8:N1} GB  {1}" -f $_.GB, $_.Path }

Write-Host ""
Write-Host "=== files over 3 GB ===" -ForegroundColor Cyan
Get-ChildItem 'C:\' -Recurse -File -Force |
    Where-Object { $_.Length -gt 3GB } |
    Sort-Object Length -Descending | Select-Object -First 20 |
    ForEach-Object { "{0,8:N1} GB  {1}" -f ($_.Length / 1GB), $_.FullName }

Write-Host ""
Write-Host "Done. Paste the two sorted lists back." -ForegroundColor Green
