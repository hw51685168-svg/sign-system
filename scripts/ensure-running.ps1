param(
  [string]$ProjectDir = "C:\CompanySystem\approval-system",
  [string]$HealthUrl = "http://localhost:3000/login"
)

$ErrorActionPreference = "SilentlyContinue"
$response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 10

if ($response.StatusCode -eq 200) {
  exit 0
}

Set-Location $ProjectDir
$env:Path = "C:\Program Files\nodejs;C:\Program Files\PostgreSQL\16\bin;$env:Path"

Start-Process `
  -FilePath "C:\Program Files\nodejs\npm.cmd" `
  -ArgumentList "run start" `
  -WorkingDirectory $ProjectDir `
  -RedirectStandardOutput (Join-Path $ProjectDir "production.log") `
  -RedirectStandardError (Join-Path $ProjectDir "production.err.log") `
  -WindowStyle Hidden
