@echo off
echo ==========================================
echo  TFMD STAGING - QUICK SETUP
echo ==========================================
echo.

REM Check if Supabase CLI is available
where supabase >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Supabase CLI not found in PATH
    echo Please run: setx PATH "%PATH%;C:\Users\Personal"
    pause
    exit /b 1
)

echo [1/4] Checking Vercel connection...
vercel whoami >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Not logged into Vercel
    echo Run: vercel login
    pause
    exit /b 1
)
echo OK - Vercel authenticated

echo.
echo [2/4] Linking to staging project...
cd /d "C:\Users\Personal\Desktop\NEW-CODE"
vercel link --project tfmd-staging --yes

echo.
echo [3/4] Deploying to staging...
vercel --prod --yes

echo.
echo [4/4] Done!
echo ==========================================
echo  STAGING URL:
echo  https://tfmd-staging.vercel.app
echo ==========================================
echo.
pause
