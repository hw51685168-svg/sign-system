param(
  [string]$Subdomain = "huangxiang-approval",
  [string]$ProjectDir = "C:\CompanySystem\approval-system",
  [string]$LocalHost = "127.0.0.1",
  [int]$LocalPort = 3000
)

$ErrorActionPreference = "Stop"
$ssh = "C:\WINDOWS\System32\OpenSSH\ssh.exe"
$keyPath = Join-Path $env:USERPROFILE ".ssh\huangxiang_serveo_ed25519"
$log = Join-Path $ProjectDir "serveo.log"
$err = Join-Path $ProjectDir "serveo.err.log"

if (-not (Test-Path $keyPath)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $keyPath -Parent) | Out-Null
  & ssh-keygen.exe -t ed25519 -N '""' -f $keyPath
}

Get-Process ssh -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -eq $ssh } |
  Stop-Process -Force -ErrorAction SilentlyContinue

Remove-Item $log, $err -Force -ErrorAction SilentlyContinue

Start-Process `
  -FilePath $ssh `
  -ArgumentList @(
    "-i", $keyPath,
    "-o", "StrictHostKeyChecking=no",
    "-o", "ServerAliveInterval=60",
    "-o", "ExitOnForwardFailure=yes",
    "-R", "$Subdomain`:80:$LocalHost`:$LocalPort",
    "serveo.net"
  ) `
  -WorkingDirectory $ProjectDir `
  -RedirectStandardOutput $log `
  -RedirectStandardError $err `
  -WindowStyle Hidden

Start-Sleep -Seconds 8
$content = ""
if (Test-Path $log) { $content += Get-Content -Raw -Path $log }
if (Test-Path $err) { $content += Get-Content -Raw -Path $err }

if ($content -match "register your SSH public key") {
  Write-Output "Serveo key registration is required."
  Write-Output "Open this URL and login with Google or GitHub:"
  Write-Output ([regex]::Match($content, "https://console\.serveo\.net/ssh/keys\?add=[^\s]+").Value)
  exit 2
}

Write-Output $content
