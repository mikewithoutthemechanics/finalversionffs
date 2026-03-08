@echo off
cd /d "C:\Users\Personal\Desktop\NEW-CODE"
echo Starting server...
start /B cmd /c "npm run dev > server-output.log 2>&1"
echo Waiting 10 seconds for server to start...
timeout /t 10 /nobreak >nul
echo.
echo Testing endpoints...
curl -s http://localhost:3000/api/health
echo.
curl -s http://localhost:3000/api/csrf-token
echo.
curl -s http://localhost:3000/api/auth/google/url
echo.
echo.
echo Server logs:
type server-output.log
