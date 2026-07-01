param(
  [string]$ProjectDir = "C:\CompanySystem\approval-system",
  [string]$TaskName = "HuangxiangApprovalSystem"
)

$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $ProjectDir "scripts\start-production.ps1"

if (-not (Test-Path $scriptPath)) {
  throw "Cannot find $scriptPath"
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ProjectDir `"$ProjectDir`""

$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
Write-Host "Startup task installed: $TaskName"
