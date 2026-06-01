# APK(emulator/device) - React Native / API logs
# Usage: .\scripts\log-apk.ps1
# Run this, then try image upload in the app.

$ErrorActionPreference = "Stop"
$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
  Write-Host "adb not found. Add Android SDK platform-tools to PATH." -ForegroundColor Red
  exit 1
}

$online = adb devices | Select-String "^\S+\s+device$"
if (-not $online) {
  Write-Host "No device online. Cold Boot emulator if needed." -ForegroundColor Red
  adb devices
  exit 1
}

$logFile = Join-Path (Split-Path $PSScriptRoot -Parent) "apk-debug.log"

# Substring match only (no regex - avoids PowerShell encoding/quantifier errors)
$needles = @(
  "[REQ]", "[RES]", "[ERR]",
  "profile-image", "/images", "thumbnail",
  "multipart", "upload", "FormData",
  "3.36.85", "eodigaljido", "Network", "Cleartext",
  "ImagePicker", "permission", "ReactNativeJS",
  " 401", " 403", " 404", " 500", "[ERR]"
)

function Test-LogLine([string]$line) {
  if ([string]::IsNullOrEmpty($line)) { return $false }
  foreach ($n in $needles) {
    if ($line.Contains($n)) { return $true }
  }
  return $false
}

Write-Host "Logging... (Ctrl+C to stop)" -ForegroundColor Cyan
Write-Host "File: $logFile" -ForegroundColor DarkGray
Write-Host ""

adb logcat -c
"" | Set-Content -Path $logFile -Encoding utf8

adb logcat -v time ReactNativeJS:V ReactNative:V chromium:I AndroidRuntime:E *:S 2>&1 |
  ForEach-Object {
    $line = $_.ToString()
    if (Test-LogLine $line) {
      Write-Host $line
      Add-Content -Path $logFile -Value $line -Encoding utf8
    }
  }
