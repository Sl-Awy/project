# share.ps1 - Build (if needed), start the PHP server, and open a Cloudflare Tunnel
# so the whole app is reachable from any device over a public HTTPS URL.
#
# Run from the project root:
#   powershell -ExecutionPolicy Bypass -File .\share.ps1
#
# Stop sharing: press Ctrl+C in this window, then close the PHP server window.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

# 1. Build the frontend if it has not been built yet.
if (-not (Test-Path "$root\frontend\dist\index.html")) {
    Write-Host "Building frontend (first run only)..." -ForegroundColor Cyan
    Push-Location "$root\frontend"
    npm install
    npm run build
    Pop-Location
}

# 2. Start the all-in-one PHP server (serves the React app + /api + admin) in its own window.
Write-Host "Starting PHP server on http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$root'; php -S 0.0.0.0:8000 -t backend backend/index.php"
)

Start-Sleep -Seconds 2

# 3. Start the Cloudflare Tunnel in THIS window. The public URL is printed below.
#    --protocol http2 uses TCP, which is the most reliable transport (avoids the
#    UDP/QUIC drops some networks/VPNs cause). Remove it to let cloudflared auto-pick.
Write-Host "Starting Cloudflare Tunnel - look for the https://...trycloudflare.com link below" -ForegroundColor Green
& "$root\cloudflared.exe" tunnel --protocol http2 --url http://localhost:8000
