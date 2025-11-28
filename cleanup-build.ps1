Write-Host "Cleaning up build artifacts..." -ForegroundColor Cyan

# Kill any running Electron processes
Write-Host "Stopping Electron processes..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*electron*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 2

# Try to remove dist-app directory
if (Test-Path "dist-app") {
    Write-Host "Removing dist-app directory..." -ForegroundColor Yellow
    try {
        Remove-Item -Path "dist-app" -Recurse -Force -ErrorAction Stop
        Write-Host "Successfully removed dist-app directory" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to remove dist-app directory automatically" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        Write-Host "`nPlease manually delete the dist-app folder and try again" -ForegroundColor Yellow
        Write-Host "If the problem persists, restart your computer" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "dist-app directory does not exist, nothing to clean" -ForegroundColor Green
}

# Try to remove dist-react directory
if (Test-Path "dist-react") {
    Write-Host "Removing dist-react directory..." -ForegroundColor Yellow
    try {
        Remove-Item -Path "dist-react" -Recurse -Force -ErrorAction Stop
        Write-Host "Successfully removed dist-react directory" -ForegroundColor Green
    }
    catch {
        Write-Host "Warning: Could not remove dist-react directory" -ForegroundColor Yellow
    }
}

Write-Host "`nCleanup completed successfully!" -ForegroundColor Green
