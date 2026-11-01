@echo off
setlocal enabledelayedexpansion

REM @file scripts/test.cmd
REM @description Windows Command Prompt (.cmd) entrypoint for running the CDD platform End-to-End (E2E) test suite.
REM @arg %* Optional CLI arguments forwarded to `scripts/test.ts`.
REM @env POSTGRES_HOST Optional PostgreSQL hostname (defaults to localhost).
REM @env POSTGRES_PORT Optional PostgreSQL port (defaults to 5432).
REM @env POSTGRES_USER Optional PostgreSQL user (defaults to postgres).
REM @env VALKEY_HOST Optional Valkey/Redis hostname (defaults to localhost).
REM @env VALKEY_PORT Optional Valkey/Redis port (defaults to 6379).
REM @env GITHUB_TOKEN Optional GitHub API token for authenticated release/WASM fetches.
REM @exitcode 0 If all services start and E2E tests pass.
REM @exitcode >0 If service startup or E2E testing fails.

pushd "%~dp0.."
call npm run test -- %*
set EXIT_CODE=%ERRORLEVEL%
popd
endlocal & exit /b %EXIT_CODE%
