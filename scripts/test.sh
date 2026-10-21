#!/bin/sh
set -eu

# scripts/test.sh
# POSIX shell entrypoint for running the CDD platform test suite.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$REPO_ROOT"
npm run test -- "$@"
