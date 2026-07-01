param(
  [string]$Domain = "huangxiang-approval",
  [string]$Token = "",
  [string]$LogPath = "C:\CompanySystem\approval-system\duckdns.log"
)

$ErrorActionPreference = "Stop"

if (-not $Token) {
  $tokenFile = "C:\CompanySystem\approval-system\.duckdns-token"
  if (Test-Path $tokenFile) {
    $Token = (Get-Content -Raw -Path $tokenFile).Trim()
  }
}

if (-not $Token) {
  throw "DuckDNS token is missing. Put it in C:\CompanySystem\approval-system\.duckdns-token."
}

$url = "https://www.duckdns.org/update?domains=$Domain&token=$Token&ip="
$result = Invoke-RestMethod -Uri $url -TimeoutSec 20
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $LogPath -Value "$stamp $Domain $result"

if ($result -ne "OK") {
  throw "DuckDNS update failed: $result"
}
