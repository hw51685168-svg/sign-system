param(
  [string]$ProjectDir = "C:\CompanySystem\approval-system",
  [string]$TaskName = "HuangxiangApprovalNotificationEscalation",
  [int]$IntervalMinutes = 10
)

$ErrorActionPreference = "Stop"
$npm = "C:\Program Files\nodejs\npm.cmd"
$action = New-ScheduledTaskAction -Execute $npm -Argument "run notifications:escalate" -WorkingDirectory $ProjectDir
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "皇享系統 Notification Escalation（通知逾時升級）排程" -Force | Out-Null
Write-Output "已建立工作排程：$TaskName，每 $IntervalMinutes 分鐘執行一次。"
