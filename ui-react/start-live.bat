@echo off
cd /d "%~dp0"
rem Runs the React UI on this PC against the live Sampark SOC Tool.
rem The login is typed here, kept only in this window's memory, and never written to a file.
set "BACKEND=https://94.136.184.140:8443"
echo UI will use the live Sampark SOC Tool at %BACKEND%
echo.
set /p "BACKEND_AUTH=Sampark SOC Tool login as user:password (example  admin:yourpassword): "
echo.
if not exist node_modules (call npm install)
call npm run dev
pause
