param(
  [Parameter(Mandatory = $true)]
  [string]$Hostname,

  [string]$TunnelName = "huangxiang-approval-system",
  [string]$LocalUrl = "http://localhost:3000",
  [string]$ProjectDir = "C:\CompanySystem\approval-system"
)

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\nodejs;C:\Program Files\PostgreSQL\16\bin;$env:Path"

$cloudflared = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  $candidate = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter cloudflared.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($candidate) {
    $cloudflared = @{ Source = $candidate.FullName }
  }
}

if (-not $cloudflared) {
  throw "cloudflared.exe not found. Install Cloudflare Tunnel first."
}

Write-Host "Step 1/5: Login to Cloudflare. Please choose the company domain in the browser."
& $cloudflared.Source tunnel login

Write-Host "Step 2/5: Create named tunnel if it does not already exist."
$list = & $cloudflared.Source tunnel list 2>&1
if ($list -notmatch [regex]::Escape($TunnelName)) {
  & $cloudflared.Source tunnel create $TunnelName
}

Write-Host "Step 3/5: Create DNS route for $Hostname."
& $cloudflared.Source tunnel route dns $TunnelName $Hostname

$cloudflaredDir = Join-Path $env:USERPROFILE ".cloudflared"
$configPath = Join-Path $cloudflaredDir "config.yml"
$tunnelInfo = & $cloudflared.Source tunnel info $TunnelName 2>&1 | Out-String
$uuidMatch = [regex]::Match($tunnelInfo, "[0-9a-fA-F-]{36}")
if (-not $uuidMatch.Success) {
  throw "Could not find tunnel UUID. Run 'cloudflared tunnel list' and verify the tunnel was created."
}

$tunnelId = $uuidMatch.Value
$credentialsFile = Join-Path $cloudflaredDir "$tunnelId.json"

Write-Host "Step 4/5: Write tunnel config."
$config = @(
  "tunnel: $tunnelId",
  "credentials-file: $credentialsFile",
  "ingress:",
  "  - hostname: $Hostname",
  "    service: $LocalUrl",
  "  - service: http_status:404"
) -join [Environment]::NewLine
Set-Content -Path $configPath -Value $config -Encoding ASCII

Write-Host "Step 5/5: Update app .env NEXTAUTH_URL."
$envPath = Join-Path $ProjectDir ".env"
$content = Get-Content -Path $envPath -Encoding UTF8
$line = "NEXTAUTH_URL=`"https://$Hostname`""
if ($content | Where-Object { $_ -match "^\s*NEXTAUTH_URL=" }) {
  $content = $content | ForEach-Object { if ($_ -match "^\s*NEXTAUTH_URL=") { $line } else { $_ } }
} else {
  $content += $line
}
Set-Content -Path $envPath -Value $content -Encoding UTF8

Write-Host ""
Write-Host "Fixed tunnel is configured."
Write-Host "Run this to start it now:"
Write-Host "cloudflared tunnel run $TunnelName"
Write-Host ""
Write-Host "Then rebuild and restart the Next.js app:"
Write-Host "cd $ProjectDir"
Write-Host "npm run build"
Write-Host "npm run start"
