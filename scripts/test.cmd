@echo off
setlocal

REM Use mise as the node manager
set LIBSCRIPT_NODE_MANAGER=mise
set LIBSCRIPT=..\libscript\libscript.cmd

echo Setting up dependencies...
call "%LIBSCRIPT%" install rust
call "%LIBSCRIPT%" install nodejs

echo Checking if databases are installed...
call "%LIBSCRIPT%" test postgres >nul 2>&1
if errorlevel 1 (
    call "%LIBSCRIPT%" install postgres
) else (
    echo PostgreSQL is already installed.
)

call "%LIBSCRIPT%" test redis >nul 2>&1
if errorlevel 1 (
    call "%LIBSCRIPT%" test valkey >nul 2>&1
    if errorlevel 1 (
        call "%LIBSCRIPT%" install valkey
    ) else (
        echo Valkey is already installed.
    )
) else (
    echo Redis is already installed.
)

echo Setting up Postgres Database for local tests...
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'cdd'" | findstr "1" >nul || psql -U postgres -c "CREATE DATABASE cdd"

echo Running E2E tests locally...
pushd e2e
call npm install
call npx playwright install
set BASE_URL=http://localhost
call npx playwright test
popd

echo Tests completed successfully.
endlocal