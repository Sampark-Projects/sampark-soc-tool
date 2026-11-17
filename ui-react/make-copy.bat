@echo off
setlocal
rem Makes a separate copy of the whole project (Sampark SOC Tool backend + the React UI in ui-react\)
rem and leaves the original folder untouched.
set "SRC=D:\sampark projects\python-repos\sampark-soc-tool"
set "DST=D:\sampark projects\python-repos\sampark-soc-tool-react"

if exist "%DST%" (
  echo The folder already exists:
  echo   %DST%
  echo Delete or rename it first, then run this again.
  pause
  exit /b 1
)

echo Copying
echo   %SRC%
echo to
echo   %DST%
echo (skips node_modules and dist; this can take a few minutes)
echo.
robocopy "%SRC%" "%DST%" /E /XD node_modules dist /NFL /NDL /NJH /NP /R:1 /W:1
rem robocopy exit codes 0-7 mean success
if errorlevel 8 (
  echo.
  echo Copy failed - see the messages above.
  pause
  exit /b 1
)

echo.
echo Done. Copy is at:
echo   %DST%
echo UI folder: %DST%\ui-react   ^(run install-and-start steps there^)
echo.
pause
