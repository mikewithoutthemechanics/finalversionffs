# Apply Supabase schema using your access token (Windows PowerShell)
# Run with: .\apply-schema.ps1
#
# Required environment variable:
#   SUPABASE_ACCESS_TOKEN - Your Supabase access token (from https://supabase.com/dashboard/account/tokens)
#   SUPABASE_PROJECT_REF  - Your Supabase project reference

# Check if environment variables are set
if (-not $env:SUPABASE_ACCESS_TOKEN) {
    Write-Host "❌ Error: SUPABASE_ACCESS_TOKEN environment variable is not set" -ForegroundColor Red
    Write-Host "   Get your token from: https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
    Write-Host "   Example: `$env:SUPABASE_ACCESS_TOKEN = 'your_token'" -ForegroundColor Yellow
    exit 1
}

if (-not $env:SUPABASE_PROJECT_REF) {
    Write-Host "❌ Error: SUPABASE_PROJECT_REF environment variable is not set" -ForegroundColor Red
    Write-Host "   Example: `$env:SUPABASE_PROJECT_REF = 'your_project_ref'" -ForegroundColor Yellow
    exit 1
}

Write-Host "🔄 Installing Supabase CLI if needed..."
npm install -g supabase

Write-Host "🔄 Logging in with access token..."
$env:SUPABASE_ACCESS_TOKEN | supabase login

Write-Host "🔄 Linking to project $env:SUPABASE_PROJECT_REF..."
supabase link --project-ref $env:SUPABASE_PROJECT_REF

Write-Host "🔄 Pushing schema..."
supabase db push

Write-Host "✅ Done! Run 'node test-supabase-connection.js' to verify."
