#!/bin/sh
set -eu

# @file deploy_with_libscript.sh
# @description POSIX /bin/sh entrypoint that installs required platform dependencies via libscript,
#   clones sibling CDD repositories, and builds/tests the CDD platform like CI.
# @arg $@ Optional CLI arguments forwarded to `npm run test`.
# @env POSTGRES_HOST Optional PostgreSQL hostname (defaults to localhost).
# @env POSTGRES_PORT Optional PostgreSQL port (defaults to 5432).
# @env POSTGRES_USER Optional PostgreSQL user (defaults to postgres).
# @env VALKEY_HOST Optional Valkey/Redis hostname (defaults to localhost).
# @env VALKEY_PORT Optional Valkey/Redis port (defaults to 6379).
# @env GITHUB_TOKEN Optional GitHub API token for authenticated release/WASM fetches.
# @exitcode 0 If all dependencies, repository clones, and tests succeed.
# @exitcode >0 If any provisioning, clone, or test step fails.

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
CDPATH='' cd -- "$SCRIPT_DIR/.."

REPOS="cdd-control-plane cdd-engine cdd-storage cdd-web-ui cdd-browser-sdk cdd-docs-ui cdd-gateway cdd-publisher"

for REPO in $REPOS; do
  if [ ! -d "$REPO" ]; then
    echo "Cloning $REPO..."
    git clone "https://github.com/SamuelMarks/$REPO.git"
  else
    echo "Repository $REPO already exists, skipping clone."
  fi
done

CDPATH='' cd -- "$SCRIPT_DIR"

echo "Building projects like CI..."
npm install
exec npm run test -- "$@"
