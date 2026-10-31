#!/bin/sh
set -eu

# deploy_with_libscript.sh
# Installs dependencies using libscript and builds projects like CI

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ -x "$SCRIPT_DIR/../libscript/libscript.sh" ]; then
  LIBSCRIPT_CMD="$SCRIPT_DIR/../libscript/libscript.sh"
else
  LIBSCRIPT_CMD="libscript"
fi

echo "Installing required dependencies via libscript..."
"$LIBSCRIPT_CMD" install rust latest
"$LIBSCRIPT_CMD" install nodejs latest
"$LIBSCRIPT_CMD" install nginx latest
"$LIBSCRIPT_CMD" install postgres latest
"$LIBSCRIPT_CMD" install valkey latest
"$LIBSCRIPT_CMD" install wait4x latest
if [ -f "$SCRIPT_DIR/libscript.json" ]; then
  "$LIBSCRIPT_CMD" install-deps "$SCRIPT_DIR/libscript.json"
fi

echo "Cloning sibling repositories (like .github/workflows/ci.yml)..."
cd "$SCRIPT_DIR/.."

REPOS="cdd-control-plane cdd-engine cdd-storage cdd-web-ui cdd-browser-sdk cdd-docs-ui cdd-gateway cdd-publisher"

for REPO in $REPOS; do
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
