$ErrorActionPreference = "Stop"

if (-not $env:NEXT_PUBLIC_API_URL) {
  throw "Set NEXT_PUBLIC_API_URL to the deployed Azure HTTPS API URL before building the static frontend."
}
if (-not $env:NEXT_PUBLIC_API_URL.StartsWith("https://")) {
  throw "Azure builds require an HTTPS API URL."
}

$env:CAPACITOR_ALLOW_HTTP = "0"
$env:CAPACITOR_BUILD = "1"
pnpm build
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
