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
Write-Host "0. Clean up old build artifacts and stop running Electron processes"
Write-Host "1. Build the React frontend (npm run build)"
Write-Host "2. Package the Electron app (npm run package)"
Write-Host "3. Start the Node.js Server (npm run prod:server)"
Write-Host ""

# 2. Cleanup old build artifacts
try {
    Write-Host "Step 0/2: Cleaning up old build artifacts..." -ForegroundColor Cyan

    # Kill any running Electron processes
    Write-Host "Stopping any running Electron processes..." -ForegroundColor Yellow
    Get-Process | Where-Object {$_.ProcessName -like "*electron*"} | Stop-Process -Force -ErrorAction SilentlyContinue

    # Wait for processes to fully terminate
    Start-Sleep -Seconds 2

    # Remove dist-app directory
    if (Test-Path "dist-app") {
        Write-Host "Removing dist-app directory..." -ForegroundColor Yellow
        try {
            Remove-Item -Path "dist-app" -Recurse -Force -ErrorAction Stop
            Write-Host "Successfully removed dist-app directory" -ForegroundColor Green
        }
        catch {
            Write-Host "Warning: Could not remove dist-app directory automatically" -ForegroundColor Red
            Write-Host "Please close any running instances of the app and manually delete the dist-app folder" -ForegroundColor Yellow
            Write-Host "Then run this script again" -ForegroundColor Yellow
            exit 1
        }
    }

    # Remove dist-react directory
    if (Test-Path "dist-react") {
        Write-Host "Removing dist-react directory..." -ForegroundColor Yellow
        Remove-Item -Path "dist-react" -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Host "Cleanup completed!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Cleanup failed: $_" -ForegroundColor Red
    exit 1
}

# 3. Build and Package
try {
    Write-Host "Step 1/2: Building and Packaging..." -ForegroundColor Cyan
    $startTime = Get-Date

    # Set API URL for the build
    $apiUrl = "http://${localIP}:3001/api"
    Write-Host "Setting API Base URL to: $apiUrl" -ForegroundColor Yellow
    $env:VITE_API_BASE_URL = $apiUrl

    # Generate config.json for runtime configuration
    $configPath = "public\config.json"
    $configContent = @{
        apiBaseUrl = $apiUrl
    } | ConvertTo-Json

    Write-Host "Generating runtime config at: $configPath" -ForegroundColor Yellow
    Set-Content -Path $configPath -Value $configContent -Encoding UTF8

    # Run the package command
    # We use cmd /c to ensure compatibility with npm scripts on Windows
    cmd /c "npm run package"

    if ($LASTEXITCODE -eq 0) {
        $duration = (Get-Date) - $startTime
        Write-Host "Build and Package Successful! (Time: $($duration.ToString('mm\:ss')))" -ForegroundColor Green

        # 4. Start Server
        Write-Host ""
        Write-Host "Step 2/3: Starting Server..." -ForegroundColor Cyan
        Write-Host "The server will start now. Keep this window open." -ForegroundColor Yellow
        Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Gray
        Write-Host ""

        cmd /c "npm run prod:server"
    } else {
        Write-Host "Build/Package failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "An error occurred: $_" -ForegroundColor Red
    exit 1
}
