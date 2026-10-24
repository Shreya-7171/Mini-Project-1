$ErrorActionPreference = "Stop"

if (-not $env:NEXT_PUBLIC_API_URL) {
  throw "Set NEXT_PUBLIC_API_URL to the backend URL before building the APK. For a same-Wi-Fi HTTP development APK, use http://10.40.7.229:8000. For distribution, use the Azure HTTPS API URL."
}

$backendUrl = [Uri]$env:NEXT_PUBLIC_API_URL
if ($backendUrl.Scheme -eq "http") {
  $env:CAPACITOR_ALLOW_HTTP = "1"
  Write-Warning "Building an HTTP LAN development APK. It will only reach a backend accessible at this address and should not be shared outside testing."
} elseif ($backendUrl.Scheme -eq "https") {
  $env:CAPACITOR_ALLOW_HTTP = "0"
} else {
  throw "NEXT_PUBLIC_API_URL must begin with http:// or https://."
}

$env:CAPACITOR_BUILD = "1"
pnpm build
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

pnpm exec cap sync android
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& ".\android\gradlew.bat" -p android assembleDebug
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Debug APK created at android\app\build\outputs\apk\debug\app-debug.apk"
