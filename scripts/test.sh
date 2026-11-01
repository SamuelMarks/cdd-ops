#!/bin/sh
set -eu

# @file scripts/test.sh
# @description POSIX /bin/sh entrypoint for running the CDD platform End-to-End (E2E) test suite.
# @arg $@ Optional CLI arguments forwarded to `scripts/test.ts`.
# @env POSTGRES_HOST Optional PostgreSQL hostname (defaults to localhost).
# @env POSTGRES_PORT Optional PostgreSQL port (defaults to 5432).
# @env POSTGRES_USER Optional PostgreSQL user (defaults to postgres).
# @env VALKEY_HOST Optional Valkey/Redis hostname (defaults to localhost).
# @env VALKEY_PORT Optional Valkey/Redis port (defaults to 6379).
# @env GITHUB_TOKEN Optional GitHub API token for authenticated release/WASM fetches.
# @exitcode 0 If all services start and E2E tests pass.
# @exitcode >0 If service startup or E2E testing fails.

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)

CDPATH='' cd -- "$REPO_ROOT"
exec npm run test -- "$@"
