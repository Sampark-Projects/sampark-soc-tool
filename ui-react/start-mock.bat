@echo off
cd /d "%~dp0"
rem Free port 8081 if an older mock (a node process) is still running there.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8081 " ^| findstr LISTENING') do (
  for /f %%N in ('tasklist /FI "PID eq %%P" /NH ^| findstr /i "node.exe"') do (
    echo Stopping old mock server ^(PID %%P^)...
    taskkill /F /PID %%P >nul 2>&1
  )
)
if not exist node_modules (call npm install)
call npm run dev:mock
pause
