@echo off
setlocal enabledelayedexpansion

REM scripts\deploy.cmd
REM Windows Command Prompt entrypoint for deploying and packaging the CDD platform locally.

pushd "%~dp0.."
call npm run deploy -- %*
set EXIT_CODE=%ERRORLEVEL%
popd
exit /b %EXIT_CODE%
