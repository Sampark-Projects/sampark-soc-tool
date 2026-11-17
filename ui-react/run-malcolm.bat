@echo off
setlocal
rem ------------------------------------------------------------------
rem  Starts the REAL Sampark SOC Tool stack (Docker) and the React UI against it.
rem  Run from a normal Command Prompt / double-click. Needs: Docker Desktop
rem  (running), Python 3, Node. Nothing here touches git.
rem  First run pulls ~25 images (several GB) and can take a long time.
rem ------------------------------------------------------------------
set "UIDIR=%~dp0"
pushd "%UIDIR%.."
set "REPO=%CD%"

set "MALCOLM_USER=admin"
set "MALCOLM_PASS=MalcolmDev123"

echo [1/5] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
  echo Docker is not running. Start Docker Desktop, wait until it says "running", then run this again.
  goto :end
)

echo [2/5] Checking Python packages for Sampark SOC Tool's control script...
python --version >nul 2>&1
if errorlevel 1 (
  echo Python 3 was not found on PATH. Install it from python.org and re-run.
  goto :end
)
python -m pip install --quiet colorama pythondialog python-rapidjson python-dotenv requests pyyaml ruamel.yaml

echo [3/5] Authentication setup (first run only)...
if exist "%REPO%\nginx\htpasswd" for %%F in ("%REPO%\nginx\htpasswd") do if %%~zF GTR 0 goto :authdone
if exist "C:\Program Files\Git\usr\bin\openssl.exe" set "PATH=%PATH%;C:\Program Files\Git\usr\bin"
where openssl >nul 2>&1
if errorlevel 1 (
  echo openssl not found, falling back to Sampark SOC Tool's interactive auth setup.
  python scripts\control.py --auth
  goto :authdone
)
for /f "delims=" %%H in ('openssl passwd -6 "%MALCOLM_PASS%"') do set "PWHASH=%%H"
python scripts\control.py --auth-noninteractive --auth-method basic ^
  --auth-admin-username %MALCOLM_USER% --auth-admin-password-openssl "%PWHASH%" ^
  --auth-arkime-password %MALCOLM_PASS% ^
  --auth-generate-webcerts --auth-generate-fwcerts ^
  --auth-generate-opensearch-internal-creds --auth-generate-netbox-passwords ^
  --auth-generate-valkey-password --auth-generate-postgres-password
if errorlevel 1 (
  echo Auth setup failed - see the message above. You can run: python scripts\control.py --auth
  goto :end
)
:authdone

echo [4/5] Starting Sampark SOC Tool (this waits until the pipelines are up)...
python scripts\control.py --start
if errorlevel 1 (
  echo Sampark SOC Tool did not start cleanly - see the message above.
  goto :end
)

echo [5/5] Starting the React UI against https://localhost ...
cd /d "%UIDIR%"
if not exist node_modules (call npm install)
set "BACKEND=https://localhost"
echo.
echo  Open http://localhost:5173/ui/   (browser will ask for the login: %MALCOLM_USER% / %MALCOLM_PASS%)
echo  Upload a .pcap on the Upload page to get data into the dashboards.
echo.
call npm run dev

:end
popd
pause
