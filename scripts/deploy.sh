#!/bin/sh
set -eu

# scripts/deploy.sh
# POSIX shell entrypoint for deploying and packaging the CDD platform locally.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$REPO_ROOT"
npm run deploy -- "$@"
