@echo off
setlocal enabledelayedexpansion

echo Installing required dependencies via libscript...
call libscript rust install rust
call libscript nodejs install nodejs
call libscript nginx install nginx
call libscript postgres install postgres
call libscript valkey install valkey

echo Cloning sibling repositories (like .github/workflows/ci.yml)...
cd ..

set REPOS=cdd-control-plane cdd-engine cdd-storage cdd-web-ui cdd-browser-sdk cdd-docs-ui cdd-gateway cdd-publisher

for %%R in (%REPOS%) do (
    if not exist "%%R\" (
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
