@echo off
setlocal enabledelayedexpansion

REM scripts	est.cmd
REM Windows Command Prompt entrypoint for running the CDD platform test suite.

pushd "%~dp0.."
call npm run test -- %*
set EXIT_CODE=%ERRORLEVEL%
popd
exit /b %EXIT_CODE%
