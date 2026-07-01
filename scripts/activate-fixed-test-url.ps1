param(
  [string]$FixedBaseUrl = "https://example.com",
  [string]$ProjectDir = "C:\CompanySystem\approval-system"
)

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\nodejs;$env:Path"

$loginUrl = "$FixedBaseUrl/login"
$response = Invoke-WebRequest -UseBasicParsing -Uri $loginUrl -TimeoutSec 20

if ($response.StatusCode -ne 200 -or $response.Content -notmatch "皇享企業|電子簽呈|登入") {
  throw "Fixed URL is not serving the Huangxiang app yet: $loginUrl"
}

$envPath = Join-Path $ProjectDir ".env"
$content = Get-Content -Path $envPath -Encoding UTF8
$line = "NEXTAUTH_URL=`"$FixedBaseUrl`""
if ($content | Where-Object { $_ -match "^\s*NEXTAUTH_URL=" }) {
  $content = $content | ForEach-Object { if ($_ -match "^\s*NEXTAUTH_URL=") { $line } else { $_ } }
} else {
  $content += $line
}
Set-Content -Path $envPath -Value $content -Encoding UTF8

Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

& "C:\Program Files\nodejs\npm.cmd" run build

Start-Process `
  -FilePath "C:\Program Files\nodejs\npm.cmd" `
  -ArgumentList "run", "start" `
  -WorkingDirectory $ProjectDir `
  -WindowStyle Hidden

Start-Sleep -Seconds 6
Write-Output "Activated fixed URL: $FixedBaseUrl"
