# build-package-start.ps1

# Set error preference to stop on error
$ErrorActionPreference = "Stop"

function Get-LocalIPAddress {
    try {
        # Get all IPv4 addresses that are not loopback
        $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
            $_.InterfaceAlias -notlike "*Loopback*" -and
            $_.IPAddress -notlike "169.254.*" # Exclude link-local
        } | Sort-Object InterfaceIndex | Select-Object -First 1).IPAddress

        if ([string]::IsNullOrWhiteSpace($ip)) {
            return "127.0.0.1"
        }
        return $ip
    } catch {
        return "127.0.0.1"
    }
}

Clear-Host
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Customer Service System - Build Script   " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$localIP = Get-LocalIPAddress

# If IP is loopback or empty, ask user to input
if ($localIP -eq "127.0.0.1" -or [string]::IsNullOrWhiteSpace($localIP)) {
    Write-Host "Could not automatically detect a valid LAN IP." -ForegroundColor Yellow
    $inputIP = Read-Host "Please enter your Local IP Address (e.g. 192.168.1.5)"
    if (-not [string]::IsNullOrWhiteSpace($inputIP)) {
        $localIP = $inputIP
    }
}

# Final safety check: Ensure IP is never empty
if ([string]::IsNullOrWhiteSpace($localIP)) {
    $localIP = "127.0.0.1"
    Write-Host "No IP provided, defaulting to 127.0.0.1" -ForegroundColor Yellow
}

Write-Host "Current Local IP: $localIP" -ForegroundColor Magenta
Write-Host "Tip: If you want other computers to access this server," -ForegroundColor Gray
Write-Host "     make sure they can ping $localIP" -ForegroundColor Gray
Write-Host ""

# 1. Confirm Action
Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "1. Build the React frontend (npm run build)"
Write-Host "2. Package the Electron app (npm run package)"
Write-Host "3. Start the Node.js Server (npm run server)"
Write-Host ""

# 2. Build and Package
try {
    Write-Host "Step 1/2: Building and Packaging..." -ForegroundColor Cyan
    $startTime = Get-Date

    # Set API URL for the build
    $apiUrl = "http://${localIP}:3001/api"
    Write-Host "Setting API Base URL to: $apiUrl" -ForegroundColor Yellow
    $env:VITE_API_BASE_URL = $apiUrl

    # Run the package command
    # We use cmd /c to ensure compatibility with npm scripts on Windows
    cmd /c "npm run package"

    if ($LASTEXITCODE -eq 0) {
        $duration = (Get-Date) - $startTime
        Write-Host "Build and Package Successful! (Time: $($duration.ToString('mm\:ss')))" -ForegroundColor Green

        # 3. Start Server
        Write-Host ""
        Write-Host "Step 2/2: Starting Server..." -ForegroundColor Cyan
        Write-Host "The server will start now. Keep this window open." -ForegroundColor Yellow
        Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Gray
        Write-Host ""

        cmd /c "npm run server"
    } else {
        Write-Host "Build/Package failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "An error occurred: $_" -ForegroundColor Red
    exit 1
}
