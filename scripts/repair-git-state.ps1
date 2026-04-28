param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$repoRoot = git rev-parse --show-toplevel
if (-not $repoRoot) {
  throw 'Not inside a git repository.'
}

$gitDirRaw = git rev-parse --git-dir
if (-not $gitDirRaw) {
  throw 'Unable to resolve git directory.'
}

$gitDir = if ([System.IO.Path]::IsPathRooted($gitDirRaw)) {
  $gitDirRaw
} else {
  [System.IO.Path]::GetFullPath((Join-Path $repoRoot $gitDirRaw))
}

$lockFiles = @(
  Join-Path $gitDir 'index.lock'
  Join-Path $gitDir 'gc.pid'
) | Where-Object { Test-Path $_ }

$gitProcesses = @(Get-Process git* -ErrorAction SilentlyContinue)
if ($gitProcesses.Count -gt 0 -and -not $Force) {
  $processList = $gitProcesses | ForEach-Object { "$($_.ProcessName)#$($_.Id)" }
  throw "Active git processes detected: $($processList -join ', '). Re-run with -Force only if you know they are stale."
}

if ($lockFiles.Count -eq 0) {
  Write-Output "No stale git lock files found in $gitDir"
  exit 0
}

foreach ($lockFile in $lockFiles) {
  Remove-Item -LiteralPath $lockFile -Force
  Write-Output "Removed $lockFile"
}
