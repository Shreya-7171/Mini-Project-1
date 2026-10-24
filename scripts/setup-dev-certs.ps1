param(
  [string]$LanIp = "10.40.7.229"
)

$ErrorActionPreference = "Stop"

$mkcertCommand = Get-Command mkcert -ErrorAction SilentlyContinue
if ($mkcertCommand) {
  $mkcert = $mkcertCommand.Source
} else {
  # WinGet can install mkcert without adding its directory to PATH.
  $wingetPackages = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
  $mkcertPackage = Get-ChildItem $wingetPackages -Directory -Filter "FiloSottile.mkcert_*" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  $installedMkcert = if ($mkcertPackage) {
    Join-Path $mkcertPackage.FullName "mkcert.exe"
  }

  if (-not $installedMkcert -or -not (Test-Path $installedMkcert)) {
    throw "mkcert is not installed. Install it with: winget install --id FiloSottile.mkcert --exact, then run this script again."
  }
  $mkcert = $installedMkcert
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$certDirectory = Join-Path $projectRoot "certs"
$keyFile = Join-Path $certDirectory "dev-key.pem"
$certFile = Join-Path $certDirectory "dev-cert.pem"

New-Item -ItemType Directory -Force -Path $certDirectory | Out-Null

& $mkcert -install
if ($LASTEXITCODE -ne 0) {
  throw "mkcert could not install its local development CA."
}

& $mkcert -key-file $keyFile -cert-file $certFile $LanIp localhost 127.0.0.1
if ($LASTEXITCODE -ne 0) {
  throw "mkcert could not generate the HTTPS certificate."
}

Write-Host "Generated certificate: $certFile"
Write-Host "Generated private key: $keyFile"
Write-Host "Local CA folder (copy rootCA.pem from here to Android):"
& $mkcert -CAROOT
