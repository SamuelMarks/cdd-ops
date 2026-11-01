@echo off
setlocal enabledelayedexpansion

REM @file deploy_with_libscript.cmd
REM @description Windows Command Prompt (.cmd) entrypoint that installs required platform dependencies
REM   via libscript, clones sibling CDD repositories, and builds/tests the CDD platform like CI.
REM @arg %* Optional CLI arguments forwarded to `npm run test`.
REM @env POSTGRES_HOST Optional PostgreSQL hostname (defaults to localhost).
REM @env POSTGRES_PORT Optional PostgreSQL port (defaults to 5432).
REM @env POSTGRES_USER Optional PostgreSQL user (defaults to postgres).
REM @env VALKEY_HOST Optional Valkey/Redis hostname (defaults to localhost).
REM @env VALKEY_PORT Optional Valkey/Redis port (defaults to 6379).
REM @env GITHUB_TOKEN Optional GitHub API token for authenticated release/WASM fetches.
REM @exitcode 0 If all dependencies, repository clones, and tests succeed.
REM @exitcode >0 If any provisioning, clone, or test step fails.

set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%..\libscript\libscript.cmd" (
    set "LIBSCRIPT_CMD=%SCRIPT_DIR%..\libscript\libscript.cmd"
) else (
    set "LIBSCRIPT_CMD=libscript"
)

echo Installing required dependencies via libscript...
call "%LIBSCRIPT_CMD%" install rust latest
if errorlevel 1 exit /b %ERRORLEVEL%
call "%LIBSCRIPT_CMD%" install nodejs latest
if errorlevel 1 exit /b %ERRORLEVEL%
call "%LIBSCRIPT_CMD%" install nginx latest
if errorlevel 1 exit /b %ERRORLEVEL%
call "%LIBSCRIPT_CMD%" install postgres latest
if errorlevel 1 exit /b %ERRORLEVEL%
call "%LIBSCRIPT_CMD%" install valkey latest
if errorlevel 1 exit /b %ERRORLEVEL%
call "%LIBSCRIPT_CMD%" install wait4x latest
if errorlevel 1 exit /b %ERRORLEVEL%
if exist "%SCRIPT_DIR%libscript.json" (
    call "%LIBSCRIPT_CMD%" install-deps "%SCRIPT_DIR%libscript.json"
    if errorlevel 1 exit /b !ERRORLEVEL!
)

echo Cloning sibling repositories (like .github/workflows/ci.yml)...
pushd "%SCRIPT_DIR%.."

set REPOS=cdd-control-plane cdd-engine cdd-storage cdd-web-ui cdd-browser-sdk cdd-docs-ui cdd-gateway cdd-publisher

for %%R in (%REPOS%) do (
    if not exist "%%R" (
        echo Cloning %%R...
        git clone "https://github.com/SamuelMarks/%%R.git"
        if errorlevel 1 (
            popd
            exit /b !ERRORLEVEL!
        )
    ) else (
        echo Repository %%R already exists, skipping clone.
    )
)

popd
pushd "%SCRIPT_DIR%"

echo Building projects like CI...
call npm install
if errorlevel 1 (
    set EXIT_CODE=%ERRORLEVEL%
    popd
    exit /b %EXIT_CODE%
)
call npm run test -- %*
set EXIT_CODE=%ERRORLEVEL%
popd
endlocal & exit /b %EXIT_CODE%
