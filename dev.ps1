# Supplex Development Server Launcher
# This script ensures Bun is in PATH before starting servers

Write-Host "🚀 Starting Supplex Development Servers..." -ForegroundColor Cyan

# Refresh PATH to include Bun
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verify Bun is available
try {
    $bunVersion = bun --version 2>$null
    Write-Host "✅ Bun $bunVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Bun not found in PATH. Please restart your terminal or reinstall Bun." -ForegroundColor Red
    exit 1
}

# Start development servers
Write-Host "`n📦 Starting frontend and backend...`n" -ForegroundColor Yellow
pnpm dev

