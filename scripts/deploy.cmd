@echo off
:: Deploys and provisions the local environment for the CDD platform.
:: Installs core dependencies (Rust, Node.js), sets up databases
:: (PostgreSQL, Redis/Valkey), builds all cdd microservices in-place,
:: and exports the built infrastructure into multiple packaging formats.

setlocal


set LIBSCRIPT=..\libscript\libscript.cmd

echo Provisioning core dependencies...
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

echo Setting up Postgres Database...
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'cdd'" | findstr "1" >nul || psql -U postgres -c "CREATE DATABASE cdd"

echo Building cdd-* repositories in-place...
for %%R in (cdd-gateway cdd-web-ui cdd-control-plane cdd-engine cdd-storage cdd-publisher cdd-docs-ui) do (
    if exist "..\%%R\" (
        echo Building %%R...
        pushd "..\%%R"
        if exist "Cargo.toml" (
            cargo build
        ) else if exist "package.json" (
            call npm install
            call npm run build --if-present
        )
        popd
    ) else (
        echo Warning: Repository ..\%%R not found, skipping.
    )
)

echo Exporting infrastructure formats...
call "%LIBSCRIPT%" package_as docker
call "%LIBSCRIPT%" package_as docker-compose
call "%LIBSCRIPT%" package_as msi
call "%LIBSCRIPT%" package_as exe
call "%LIBSCRIPT%" package_as deb

echo Deployment script completed successfully.
endlocal
