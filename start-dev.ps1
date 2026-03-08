#!/usr/bin/env pwsh
# Start development server with correct environment

$ErrorActionPreference = "Stop"

# Change to script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TFMD Booking App - Development Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verify .env exists
if (!(Test-Path ".env")) {
    Write-Host "❌ ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "   Create one from .env.example" -ForegroundColor Yellow
    exit 1
}

# Load and display key env vars
$envContent = Get-Content ".env" -Raw
$hasSupabaseUrl = $envContent -match "VITE_SUPABASE_URL=https://"
$hasSupabaseKey = $envContent -match "VITE_SUPABASE_ANON_KEY=eyJ"
$hasGoogleId = $envContent -match "GOOGLE_CLIENT_ID=\d+"
$hasGoogleSecret = $envContent -match "GOOGLE_CLIENT_SECRET=GOCSPX"

Write-Host "📋 Environment Check:" -ForegroundColor Yellow
Write-Host "   Supabase URL: $(if ($hasSupabaseUrl) { '✅' } else { '❌' })"
Write-Host "   Supabase Key: $(if ($hasSupabaseKey) { '✅' } else { '❌' })"
Write-Host "   Google OAuth ID: $(if ($hasGoogleId) { '✅' } else { '❌' })"
Write-Host "   Google OAuth Secret: $(if ($hasGoogleSecret) { '✅' } else { '❌' })"
Write-Host ""

# Export env vars for Node
Get-Content ".env" | ForEach-Object {
    if ($_ -match "^([^#][^=]*)=(.*)$") {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

Write-Host "🚀 Starting development server..." -ForegroundColor Green
Write-Host "   URL: http://localhost:3000" -ForegroundColor Cyan
Write-Host "   API: http://localhost:3000/api" -ForegroundColor Cyan
Write-Host ""

# Start the server
npm run dev
