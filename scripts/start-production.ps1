param(
  [string]$ProjectDir = "C:\CompanySystem\approval-system"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectDir
$env:Path = "C:\Program Files\nodejs;C:\Program Files\PostgreSQL\16\bin;$env:Path"

if (-not (Test-Path ".env")) {
  throw "Missing .env. Copy .env.example to .env and update DATABASE_URL/NEXTAUTH_SECRET first."
}

& "C:\Program Files\nodejs\npm.cmd" run start
