param(
  [string]$BackupDir = "C:\CompanySystem\backups",
  [string]$UploadDir = "C:\CompanySystem\approval-uploads",
  [string]$DatabaseName = "approval_system",
  [string]$DatabaseUser = "postgres",
  [string]$DatabasePassword = "postgres",
  [string]$DatabaseHost = "localhost",
  [int]$DatabasePort = 5432,
  [int]$KeepDays = 14
)

$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$todayDir = Join-Path $BackupDir $stamp
New-Item -ItemType Directory -Force -Path $todayDir | Out-Null

$pgDump = Get-Command pg_dump.exe -ErrorAction SilentlyContinue
if (-not $pgDump) {
  $commonPath = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
  if (Test-Path $commonPath) {
    $pgDump = @{ Source = $commonPath }
  }
}

if (-not $pgDump) {
  throw "pg_dump.exe not found. Add PostgreSQL bin folder to PATH or update this script."
}

$dbBackup = Join-Path $todayDir "$DatabaseName.dump"
$env:PGPASSWORD = $DatabasePassword
& $pgDump.Source `
  --host $DatabaseHost `
  --port $DatabasePort `
  --username $DatabaseUser `
  --format custom `
  --file $dbBackup `
  $DatabaseName

if (Test-Path $UploadDir) {
  $uploadZip = Join-Path $todayDir "approval-uploads.zip"
  Compress-Archive -Path (Join-Path $UploadDir "*") -DestinationPath $uploadZip -Force
}

Get-ChildItem $BackupDir -Directory |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  Remove-Item -Recurse -Force

Write-Host "Backup complete: $todayDir"
