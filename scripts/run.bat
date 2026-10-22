@echo off
REM ---------------------------------------------------------------------------
REM CivicSense launcher. Starts the database (if needed), the API and the web
REM app, then opens the browser.
REM
REM   scripts\run.bat          start everything and open the browser
REM   scripts\run.bat --stop   stop the API and the web app
REM ---------------------------------------------------------------------------
setlocal EnableDelayedExpansion
set ROOT=%~dp0..
set VENV=%ROOT%\.venv\Scripts\python.exe
set API=http://127.0.0.1:8000
set WEB=http://127.0.0.1:5173

if /i "%~1"=="--stop" goto :stop

REM --- 1. database ---------------------------------------------------------
call :db_up
if errorlevel 1 (
  echo [1/3] starting PostgreSQL + PostGIS ...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\local-db.ps1" start
  if errorlevel 1 goto :db_failed
  call :db_up
  if errorlevel 1 goto :db_failed
) else (
  echo [1/3] database already running
)

REM --- 2. API --------------------------------------------------------------
call :api_up
if errorlevel 1 (
  echo [2/3] starting the API on %API%
  start "CivicSense API" cmd /k "cd /d "%ROOT%\backend" && "%VENV%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
  powershell -NoProfile -Command ^
    "1..60 | ForEach-Object { Start-Sleep -Milliseconds 500; try { (Invoke-WebRequest -Uri '%API%/health' -TimeoutSec 3 -UseBasicParsing) | Out-Null; exit 0 } catch { } }; exit 1" >nul 2>&1
  if errorlevel 1 (
    echo [2/3] WARNING: the API did not answer in time. Check the "CivicSense API" window.
  )
) else (
  echo [2/3] API already running on %API%
)

REM --- 3. web app ----------------------------------------------------------
call :web_up
if errorlevel 1 (
  echo [3/3] starting the web app on %WEB%
  start "CivicSense web" cmd /k "cd /d "%ROOT%\frontend" && npm run dev -- --host 127.0.0.1 --port 5173"
  powershell -NoProfile -Command ^
    "1..60 | ForEach-Object { Start-Sleep -Milliseconds 500; try { (Invoke-WebRequest -Uri '%WEB%' -TimeoutSec 3 -UseBasicParsing) | Out-Null; exit 0 } catch { } }; exit 1" >nul 2>&1
  if errorlevel 1 (
    echo [3/3] WARNING: the web app did not answer in time. Check the "CivicSense web" window.
  )
) else (
  echo [3/3] web app already running on %WEB%
)

echo.
echo   Web app   %WEB%
echo   API docs  %API%/docs
echo   Sign in   admin / 1234
echo.
start "" "%WEB%"
endlocal
goto :eof

:db_failed
echo.
echo [1/3] FAILED: the database could not be started.
echo        Run this once: powershell -ExecutionPolicy Bypass -File scripts\local-db.ps1 setup
echo.
endlocal
exit /b 1

REM --- helpers -------------------------------------------------------------
:db_up
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\local-db.ps1" status >nul 2>&1
exit /b %errorlevel%

:api_up
powershell -NoProfile -Command ^
  "try { $r = (Invoke-WebRequest -Uri '%API%/health' -TimeoutSec 4 -UseBasicParsing).Content; if ($r -match 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%

:web_up
powershell -NoProfile -Command ^
  "try { (Invoke-WebRequest -Uri '%WEB%' -TimeoutSec 4 -UseBasicParsing) | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%

:stop
echo stopping ...
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'uvicorn app.main:app|vite' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
echo done
endlocal
goto :eof
