@echo off
setlocal enabledelayedexpansion

REM deploy_with_libscript.cmd
REM Installs dependencies using libscript and builds projects like CI

set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%..\libscript\libscript.cmd" (
    set "LIBSCRIPT_CMD=%SCRIPT_DIR%..\libscript\libscript.cmd"
) else (
    set "LIBSCRIPT_CMD=libscript"
)

echo Installing required dependencies via libscript...
call "%LIBSCRIPT_CMD%" install rust latest
call "%LIBSCRIPT_CMD%" install nodejs latest
call "%LIBSCRIPT_CMD%" install nginx latest
call "%LIBSCRIPT_CMD%" install postgres latest
call "%LIBSCRIPT_CMD%" install valkey latest
if exist "%SCRIPT_DIR%libscript.json" (
    call "%LIBSCRIPT_CMD%" install-deps "%SCRIPT_DIR%libscript.json"
)

echo Cloning sibling repositories (like .github/workflows/ci.yml)...
cd /d "%SCRIPT_DIR%.."

set REPOS=cdd-control-plane cdd-engine cdd-storage cdd-web-ui cdd-browser-sdk cdd-docs-ui cdd-gateway cdd-publisher

for %%R in (%REPOS%) do (
    if not exist "%%R" (
        echo Cloning %%R...
        git clone "https://github.com/SamuelMarks/%%R.git"
    ) else (
        echo Repository %%R already exists, skipping clone.
    )
)

cd cdd-ops

echo Building projects like CI...
call npm install
call npm run test

endlocal
