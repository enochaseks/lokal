# Script to restart the application with a clean environment
# This ensures all environment variables are properly loaded

Write-Host "Stopping any running React processes..."
Stop-Process -Name "node" -ErrorAction SilentlyContinue
Write-Host "Clearing cache..."
npm cache clean --force
Write-Host "Starting application with clean environment..."
npm start