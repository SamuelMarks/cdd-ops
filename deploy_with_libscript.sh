#!/bin/bash
set -e

# deploy_with_libscript.sh
# Installs dependencies using libscript and builds projects like CI

echo "Installing required dependencies via libscript..."
libscript rust install rust
libscript nodejs install nodejs
libscript nginx install nginx
libscript postgres install postgres
libscript valkey install valkey

echo "Cloning sibling repositories (like .github/workflows/ci.yml)..."
cd ..

REPOS=(
  "cdd-control-plane"
  "cdd-engine"
  "cdd-storage"
  "cdd-web-ui"
  "cdd-browser-sdk"
  "cdd-docs-ui"
  "cdd-gateway"
  "cdd-publisher"
)

for REPO in "${REPOS[@]}"; do
  if [ ! -d "$REPO" ]; then
    echo "Cloning $REPO..."
    git clone "https://github.com/SamuelMarks/$REPO.git"
  else
    echo "Repository $REPO already exists, skipping clone."
  fi
done

cd cdd-ops

echo "Building projects like CI..."
npm install
npm run test
