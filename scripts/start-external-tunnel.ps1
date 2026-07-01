param(
  [string]$ProjectDir = "C:\CompanySystem\approval-system",
  [string]$LocalUrl = "http://localhost:3000",
  [switch]$RestartAppAfterUrlUpdate
)

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\nodejs;C:\Program Files\PostgreSQL\16\bin;$env:Path"

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Name,
    [string]$Value
  )

  $line = "$Name=`"$Value`""
  if (-not (Test-Path $Path)) {
    Set-Content -Path $Path -Value $line -Encoding UTF8
    return
  }

  $content = Get-Content -Path $Path -Encoding UTF8
  $pattern = "^\s*$([regex]::Escape($Name))="
  if ($content | Where-Object { $_ -match $pattern }) {
    $content = $content | ForEach-Object {
      if ($_ -match $pattern) { $line } else { $_ }
    }
  } else {
    $content += $line
  }
  Set-Content -Path $Path -Value $content -Encoding UTF8
}

function Restart-ApprovalApp {
  param([string]$ProjectDir)

  Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

  Start-Process `
    -FilePath "C:\Program Files\nodejs\npm.cmd" `
    -ArgumentList "run start" `
    -WorkingDirectory $ProjectDir `
    -RedirectStandardOutput (Join-Path $ProjectDir "production.log") `
    -RedirectStandardError (Join-Path $ProjectDir "production.err.log") `
    -WindowStyle Hidden
}

$cloudflared = Get-Command cloudflared.exe -ErrorAction SilentlyContinue

if (-not $cloudflared) {
  $candidate = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter cloudflared.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($candidate) {
    $cloudflared = @{ Source = $candidate.FullName }
  }
}

if (-not $cloudflared) {
  throw "cloudflared.exe not found."
}

Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$log = Join-Path $ProjectDir "cloudflared.log"
$err = Join-Path $ProjectDir "cloudflared.err.log"
Remove-Item $log, $err -Force -ErrorAction SilentlyContinue

Start-Process `
  -FilePath $cloudflared.Source `
  -ArgumentList "tunnel --url $LocalUrl --no-autoupdate" `
  -WorkingDirectory $ProjectDir `
  -RedirectStandardOutput $log `
  -RedirectStandardError $err `
  -WindowStyle Hidden

Start-Sleep -Seconds 12
$content = ""
if (Test-Path $log) { $content += Get-Content $log -Raw }
if (Test-Path $err) { $content += Get-Content $err -Raw }

$match = [regex]::Match($content, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
if ($match.Success) {
  $envPath = Join-Path $ProjectDir ".env"
  Set-EnvValue -Path $envPath -Name "NEXTAUTH_URL" -Value $match.Value
  Set-EnvValue -Path $envPath -Name "NEXTAUTH_URL_INTERNAL" -Value $LocalUrl

  $text = @(
    "Huangxiang approval system URLs",
    "",
    "Local: http://localhost:3000",
    "LAN: http://192.168.1.25:3000",
    "External quick tunnel: $($match.Value)",
    "",
    "Note: Cloudflare quick tunnel URLs may change after restart.",
    "Test credentials are in the desktop credential text file."
  ) -join [Environment]::NewLine
  Set-Content -Path (Join-Path $ProjectDir "system-url.txt") -Value $text -Encoding UTF8
  Set-Content -Path (Join-Path $env:USERPROFILE "Desktop\huangxiang-system-url.txt") -Value $text -Encoding UTF8

  if ($RestartAppAfterUrlUpdate) {
    Restart-ApprovalApp -ProjectDir $ProjectDir
  }
}
