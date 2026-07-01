param(
  [string]$ProjectDir = "C:\CompanySystem\approval-system",
  [string]$TaskName = "HuangxiangApprovalSystemDailyBackup",
  [string]$At = "02:30"
)

$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $ProjectDir "scripts\backup.ps1"

if (-not (Test-Path $scriptPath)) {
  throw "Cannot find $scriptPath"
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger -Daily -At $At
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
Write-Host "Daily backup task installed: $TaskName at $At"
