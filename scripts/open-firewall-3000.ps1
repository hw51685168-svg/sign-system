$ErrorActionPreference = "Stop"

$ruleName = "Huangxiang Approval System 3000"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existing) {
  Write-Host "Firewall rule already exists: $ruleName"
  return
}

New-NetFirewallRule `
  -DisplayName $ruleName `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 3000 `
  -Profile Private

Write-Host "Firewall opened for TCP 3000 on Private network."
