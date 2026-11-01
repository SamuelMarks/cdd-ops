@echo off
setlocal enabledelayedexpansion

REM @file scripts/deploy.cmd
REM @description Windows Command Prompt (.cmd) entrypoint for deploying and packaging the CDD platform locally.
REM @arg %* Optional CLI flags forwarded to `scripts/deploy.ts` (e.g., `--target msi --target deb`).
REM @env POSTGRES_HOST Optional PostgreSQL hostname (defaults to localhost).
REM @env POSTGRES_PORT Optional PostgreSQL port (defaults to 5432).
REM @env POSTGRES_USER Optional PostgreSQL user (defaults to postgres).
REM @env VALKEY_HOST Optional Valkey/Redis hostname (defaults to localhost).
REM @env VALKEY_PORT Optional Valkey/Redis port (defaults to 6379).
REM @env GITHUB_TOKEN Optional GitHub API token for downloading prebuilt microservice binaries.
REM @exitcode 0 If deployment and packaging succeed.
REM @exitcode >0 If deployment or packaging fails.

pushd "%~dp0.."
call npm run deploy -- %*
set EXIT_CODE=%ERRORLEVEL%
popd
endlocal & exit /b %EXIT_CODE%
