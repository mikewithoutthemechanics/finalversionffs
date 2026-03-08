# Set Admin Users Script for TFMD Booking App
# Uses Supabase REST API with service_role key

$SupabaseUrl = "https://lxdtovoakxekjrkexbae.supabase.co"
$ServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZHRvdm9ha3hla2pya2V4YmFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjExNjA4MSwiZXhwIjoyMDg3NjkyMDgxfQ.aAWE8zdfCm9mX5yg8vSbEFUuUTpTulVB4jijHASKk3A"

$Headers = @{
    "apikey" = $ServiceKey
    "Authorization" = "Bearer $ServiceKey"
    "Content-Type" = "application/json"
    "Prefer" = "resolution=merge-duplicates"
}

$AdminUsers = @(
    @{
        id = "admin-michael-agentcy"
        email = "michael@agentcy.co.za"
        name = "Michael"
        isAdmin = $true
        waiverAccepted = $true
    },
    @{
        id = "admin-zelda"
        email = "zelda@thefasciadome.co.za"
        name = "Zelda"
        isAdmin = $true
        waiverAccepted = $true
    },
    @{
        id = "admin-jo"
        email = "jo@thefasciadome.co.za"
        name = "Jo"
        isAdmin = $true
        waiverAccepted = $true
    },
    @{
        id = "admin-michael-gmail"
        email = "michaelgraemek@gmail.com"
        name = "Michael Graeme"
        isAdmin = $true
        waiverAccepted = $true
    }
)

Write-Host "Setting admin users..." -ForegroundColor Cyan
Write-Host ""

foreach ($User in $AdminUsers) {
    $Body = $User | ConvertTo-Json -Depth 10
    
    try {
        $Response = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/users" -Method POST -Headers $Headers -Body $Body
        Write-Host "✅ Created/Updated: $($User.email)" -ForegroundColor Green
    } catch {
        # Try PATCH if POST fails (user might exist)
        try {
            $PatchHeaders = @{
                "apikey" = $ServiceKey
                "Authorization" = "Bearer $ServiceKey"
                "Content-Type" = "application/json"
            }
            $PatchBody = @{ isAdmin = $true } | ConvertTo-Json
            $PatchResponse = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/users?id=eq.$($User.id)" -Method PATCH -Headers $PatchHeaders -Body $PatchBody
            Write-Host "✅ Updated existing: $($User.email)" -ForegroundColor Green
        } catch {
            Write-Host "❌ Failed: $($User.email) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "Verifying admin users..." -ForegroundColor Cyan

# Verify the users were set as admins
$VerifyHeaders = @{
    "apikey" = $ServiceKey
    "Authorization" = "Bearer $ServiceKey"
}

try {
    $VerifyResponse = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/users?select=email,name,isAdmin&email=in.('michael@agentcy.co.za','zelda@thefasciadome.co.za','jo@thefasciadome.co.za','michaelgraemek@gmail.com')" -Method GET -Headers $VerifyHeaders
    Write-Host ""
    Write-Host "Current admin status:" -ForegroundColor Yellow
    $VerifyResponse | ForEach-Object {
        $Status = if ($_.isAdmin -eq "True") { "✅ ADMIN" } else { "❌ Not Admin" }
        Write-Host "  $($_.email) - $($_.name) - $Status"
    }
} catch {
    Write-Host "❌ Verification failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
